"""
routers/jobs.py — POST /api/jobs  |  GET /api/jobs/{id}  |  GET /api/jobs/{id}/stream
"""



import asyncio
import json
import logging
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from dependencies import verify_internal_api_key
from limiter import limiter, JOB_CREATE_RATE_LIMIT
from models.schemas import (
    DownloadMode,
    Job,
    JobCreateRequest,
    JobCreateResponse,
    JobStatus,
    JobStatusResponse,
    ErrorResponse,
)
from services import downloader
from services.processor import check_ffmpeg
from utils import validate_youtube_url

router = APIRouter(dependencies=[Depends(verify_internal_api_key)])
logger = logging.getLogger(__name__)

# Maximum time (seconds) the SSE stream will stay open waiting for a terminal event.
_SSE_TIMEOUT_SECONDS   = 3600
# Interval between SSE heartbeat/status ticks.
_SSE_POLL_INTERVAL     = 0.5


# ---------------------------------------------------------------------------
# POST /api/jobs
# ---------------------------------------------------------------------------

@router.post(
    "/jobs",
    response_model=JobCreateResponse,
    responses={
        400: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Create and start a new download job",
)
@limiter.limit(f"{JOB_CREATE_RATE_LIMIT}/minute")
async def create_job(
    request: Request,
    response: Response,
    body: Annotated[JobCreateRequest, Body()],
) -> JobCreateResponse:
    # URL validation
    is_valid, error_msg, clean_url = validate_youtube_url(body.url)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    assert clean_url is not None

    # FFmpeg guard for trim and merge operations
    if body.trim_enabled or (
        body.mode == DownloadMode.VIDEO and body.video_type.value == "video_audio"
    ):
        if not check_ffmpeg():
            raise HTTPException(
                status_code=400,
                detail="FFmpeg is required for this operation but is not installed on the server.",
            )

    job_id = str(body.job_id)

    async with downloader.async_state_lock:
        if downloader.is_downloading:
            raise HTTPException(
                status_code=409,
                detail="A download is already in progress. Please wait.",
            )

        if job_id in downloader.jobs:
            raise HTTPException(
                status_code=409,
                detail="A job with this ID already exists.",
            )

        job = Job(
            id=job_id,
            url=clean_url,
            mode=body.mode.value,
            user_id=str(body.user_id),
            video_type=body.video_type.value,
            quality=body.quality,
            thumbnail_format=body.thumbnail_format.value,
            trim_enabled=body.trim_enabled,
            trim_start=body.trim_start if body.trim_enabled else None,
            trim_end=body.trim_end   if body.trim_enabled else None,
        )

        downloader.jobs[job.id]  = job
        downloader.is_downloading = True

    logger.info(
        "Job created | id=%s  mode=%s  url=%s  user=%s",
        job.id, job.mode, job.url, job.user_id,
    )

    try:
        downloader.download_video(job)
    except Exception as exc:
        async with downloader.async_state_lock:
            downloader.is_downloading = False
            downloader.jobs.pop(job.id, None)
        logger.error("Failed to start download thread for job %s: %s", job.id, exc)
        raise HTTPException(status_code=500, detail="Failed to start download. Please try again.")

    return JobCreateResponse(success=True, data={"job_id": job.id})


# ---------------------------------------------------------------------------
# GET /api/jobs/{job_id}
# ---------------------------------------------------------------------------

@router.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Poll the current status of a job",
)
async def get_job(job_id: str) -> JobStatusResponse:
    async with downloader.async_state_lock:
        job = downloader.jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobStatusResponse(success=True, data=job.to_status_data())


# ---------------------------------------------------------------------------
# GET /api/jobs/{job_id}/stream  — Server-Sent Events
# ---------------------------------------------------------------------------

async def _event_generator(job_id: str) -> AsyncGenerator[str, None]:
    """
    Yield SSE events until the job reaches a terminal state or the timeout expires.

    Design notes:
        - Sleep-first avoids emitting a stale "initializing" event immediately
          on connect before the worker thread has had a chance to advance.
        - State is snapshot under the lock; the lock is released before yielding
          so other coroutines are not blocked during I/O.
        - When status turns terminal, a guaranteed final event is emitted after
          the regular tick, then the generator exits cleanly.
        - A hard timeout prevents the generator running forever if the worker
          thread silently dies without updating job.status.
    """
    elapsed = 0.0

    while elapsed < _SSE_TIMEOUT_SECONDS:
        await asyncio.sleep(_SSE_POLL_INTERVAL)
        elapsed += _SSE_POLL_INTERVAL

        async with downloader.async_state_lock:
            job = downloader.jobs.get(job_id)

        if not job:
            yield _sse({"stage": "error", "message": "Job not found"})
            return

        yield _sse(job.to_sse_dict())

        if job.status == JobStatus.SUCCESS.value:
            yield _sse({
                "stage":   "complete",
                "percent": 100,
                "file_id": job.id,
                "message": "Download complete",
            })
            return

        if job.status == JobStatus.FAILED.value:
            yield _sse({
                "stage":   "error",
                "percent": job.progress,
                "message": job.error_message or "Download failed",
            })
            return

    # Timeout — emit a terminal error so the client does not hang indefinitely.
    logger.warning("SSE stream for job %s timed out after %ss", job_id, _SSE_TIMEOUT_SECONDS)
    yield _sse({"stage": "error", "message": "Stream timed out. Please check job status manually."})


def _sse(payload: dict) -> str:
    """Serialise a dict to a single SSE data line."""
    return f"data: {json.dumps(payload)}\n\n"


@router.get(
    "/jobs/{job_id}/stream",
    responses={404: {"model": ErrorResponse}},
    summary="Stream real-time job progress via Server-Sent Events",
)
async def stream_job_status(job_id: str) -> StreamingResponse:
    async with downloader.async_state_lock:
        if job_id not in downloader.jobs:
            raise HTTPException(status_code=404, detail="Job not found")

    return StreamingResponse(
        _event_generator(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )