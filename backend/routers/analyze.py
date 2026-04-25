"""
routers/analyze.py — POST /api/analyze
"""



import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import Response

from dependencies import verify_internal_api_key
from limiter import limiter, ANALYZE_RATE_LIMIT
from models.schemas import AnalyzeData, AnalyzeRequest, AnalyzeResponse, ErrorResponse
from services import downloader
from utils import format_error_message, validate_youtube_url

router = APIRouter(dependencies=[Depends(verify_internal_api_key)])
logger = logging.getLogger(__name__)

_ANALYZE_TIMEOUT_SECONDS = 60


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    responses={
        400: {"model": ErrorResponse},
        408: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Extract metadata for a YouTube video URL",
)
@limiter.limit(f"{ANALYZE_RATE_LIMIT}/minute")
async def analyze_video(
    request: Request,
    response: Response,
    body: Annotated[AnalyzeRequest, Body()],
) -> AnalyzeResponse:
    is_valid, error_msg, clean_url = validate_youtube_url(body.url)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # validate_youtube_url guarantees clean_url is non-None when is_valid=True,
    # but we narrow the type explicitly for the static analyser.
    assert clean_url is not None

    try:
        loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
        data: AnalyzeData = await asyncio.wait_for(
            loop.run_in_executor(None, downloader.analyze_video, clean_url),
            timeout=_ANALYZE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("Analyze timed out for URL: %s", clean_url)
        raise HTTPException(
            status_code=408,
            detail="Request timed out while fetching video information. Please try again.",
        )
    except (ValueError, ConnectionError) as exc:
        logger.warning("Analyze failed for %s: %s", clean_url, exc)
        raise HTTPException(status_code=400, detail=format_error_message(exc))
    except Exception as exc:
        logger.error("Unexpected error analyzing %s: %s", clean_url, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=format_error_message(exc))

    return AnalyzeResponse(success=True, data=data)