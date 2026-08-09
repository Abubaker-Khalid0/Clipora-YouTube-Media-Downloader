"""
routers/transcript.py — POST /api/transcript

Fetches the transcript/subtitles for a YouTube video.
"""

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from starlette.responses import Response

from dependencies import verify_internal_api_key
from limiter import limiter, ANALYZE_RATE_LIMIT
from models.schemas import (
    ErrorResponse,
    TranscriptData,
    TranscriptLanguageInfo,
    TranscriptRequest,
    TranscriptResponse,
    TranscriptSnippet,
)
from services.transcript import fetch_transcript
from utils import format_error_message

router = APIRouter(dependencies=[Depends(verify_internal_api_key)])
logger = logging.getLogger(__name__)

_TRANSCRIPT_TIMEOUT_SECONDS = 30


@router.post(
    "/transcript",
    response_model=TranscriptResponse,
    responses={
        400: {"model": ErrorResponse},
        408: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Fetch transcript/subtitles for a YouTube video",
)
@limiter.limit(f"{ANALYZE_RATE_LIMIT}/minute")
async def get_transcript(
    request: Request,
    response: Response,
    body: Annotated[TranscriptRequest, Body()],
) -> TranscriptResponse:
    try:
        loop = asyncio.get_running_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(
                None, fetch_transcript, body.video_id, body.lang
            ),
            timeout=_TRANSCRIPT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("Transcript timed out for video: %s", body.video_id)
        raise HTTPException(
            status_code=408,
            detail="Request timed out while fetching transcript. Please try again.",
        )
    except ValueError as exc:
        logger.warning("Transcript unavailable for %s: %s", body.video_id, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except ConnectionError as exc:
        logger.warning("Transcript connection error for %s: %s", body.video_id, exc)
        raise HTTPException(status_code=400, detail=format_error_message(exc))
    except Exception as exc:
        logger.error(
            "Unexpected error fetching transcript for %s: %s",
            body.video_id,
            exc,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=format_error_message(exc))

    # Convert service result → Pydantic response
    data = TranscriptData(
        snippets=[
            TranscriptSnippet(text=s.text, start=s.start, duration=s.duration)
            for s in result.snippets
        ],
        available_languages=[
            TranscriptLanguageInfo(
                code=lang.code, name=lang.name, is_generated=lang.is_generated
            )
            for lang in result.available_languages
        ],
        language=result.language,
        language_code=result.language_code,
        is_generated=result.is_generated,
        video_id=result.video_id,
    )

    return TranscriptResponse(success=True, data=data)
