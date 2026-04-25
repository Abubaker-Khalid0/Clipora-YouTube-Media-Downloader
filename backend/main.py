"""
main.py — Clipora Backend API entry point.

Responsibilities:
    - Load environment and validate critical configuration at startup.
    - Configure structured logging, CORS, rate-limiting, and exception handlers.
    - Register all API routers.
    - Manage the CleanupService lifecycle via FastAPI lifespan.
"""

from __future__ import annotations

import logging
import logging.config
import os
import time
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

# load_dotenv() MUST run before any custom import that reads os.getenv()
# at module level (e.g. dependencies.py reads INTERNAL_API_KEY on import).
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from dependencies import verify_internal_api_key  # noqa: F401 — imported to trigger early validation
from limiter import limiter
from routers import analyze, files, jobs
from services import downloader
from services.cleanup import CleanupService
from services.processor import check_ffmpeg


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _configure_logging() -> None:
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
    })

_configure_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

def _require_env(name: str, min_length: int = 0) -> str:
    value = os.getenv(name, "").strip()
    if not value or len(value) < min_length:
        raise RuntimeError(
            f"{name} must be set and at least {min_length} characters. "
            'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
        )
    return value


INTERNAL_API_KEY         = _require_env("INTERNAL_API_KEY", min_length=32)
FRONTEND_URL             = os.getenv("FRONTEND_URL", "http://localhost:3000").strip()
STORAGE_PATH             = Path(os.getenv("STORAGE_PATH", "storage/temp"))
CLEANUP_INTERVAL_SECONDS = int(os.getenv("CLEANUP_INTERVAL_SECONDS", "300"))
FILE_EXPIRY_SECONDS      = int(os.getenv("MAX_FILE_AGE_MINUTES", "30")) * 60
ENV                      = os.getenv("ENV", "production").lower()

if FRONTEND_URL == "*":
    raise RuntimeError(
        "FRONTEND_URL cannot be '*' when allow_credentials=True. "
        "Set it to the exact frontend origin."
    )

STORAGE_PATH.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------

_cleanup_service = CleanupService(
    temp_dir=STORAGE_PATH,
    cleanup_interval_seconds=CLEANUP_INTERVAL_SECONDS,
    file_expiry_seconds=FILE_EXPIRY_SECONDS,
    jobs_store=downloader.jobs,
)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Clipora backend starting up")
    logger.info("ENV=%s  FRONTEND_URL=%s  STORAGE=%s", ENV, FRONTEND_URL, STORAGE_PATH.resolve())
    logger.info("Cleanup: interval=%ss  expiry=%ss", CLEANUP_INTERVAL_SECONDS, FILE_EXPIRY_SECONDS)
    logger.info("FFmpeg available: %s", check_ffmpeg())

    _cleanup_service.start()

    yield

    _cleanup_service.stop()
    logger.info("Clipora backend shut down cleanly")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Clipora Backend API",
    description="YouTube video, audio, and thumbnail downloader",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if ENV == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if ENV == "development" else None,
)

app.state.limiter = limiter


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-Api-Key", "X-User-Id"],
    allow_credentials=True,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    logger.info("[→] %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "[←] %s %s  %s  %sms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.error(
            "[✗] %s %s  %sms  %s",
            request.method,
            request.url.path,
            duration_ms,
            exc,
        )
        raise


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait before trying again."},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "[UnhandledException] %s %s | %s: %s\n%s",
        request.method,
        request.url.path,
        type(exc).__name__,
        exc,
        traceback.format_exc(),
    )
    body: dict = {
        "error":  "Internal server error",
        "type":   type(exc).__name__,
        "detail": str(exc),
    }
    if ENV == "development":
        body["traceback"] = traceback.format_exc()

    return JSONResponse(status_code=500, content=body)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", include_in_schema=False)
async def health_check() -> dict:
    async with downloader.async_state_lock:
        active_jobs = [
            job_id
            for job_id, job in downloader.jobs.items()
            if job.status == "processing"
        ]

    return {
        "status":                "ok",
        "env":                   ENV,
        "ffmpeg_available":      check_ffmpeg(),
        "active_jobs":           active_jobs,
        "total_jobs_in_memory":  len(downloader.jobs),
    }


app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(jobs.router,    prefix="/api", tags=["jobs"])
app.include_router(files.router,   prefix="/api", tags=["files"])


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)