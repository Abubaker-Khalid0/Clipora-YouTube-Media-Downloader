"""
routers/files.py — GET /api/files/download/{job_id}
"""

from __future__ import annotations

import logging
import os
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse

from dependencies import verify_internal_api_key
from models.schemas import ErrorResponse, JobStatus
from services import downloader
from utils import sanitize_filename

router = APIRouter(dependencies=[Depends(verify_internal_api_key)])
logger = logging.getLogger(__name__)


@router.get(
    "/files/download/{job_id}",
    responses={
        200: {"description": "Binary file download"},
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="Download the output file for a completed job",
)
async def download_file(
    job_id: str,
    x_user_id: Annotated[
        str | None,
        Header(
            alias="x-user-id",
            description="Supabase user UUID — must match the job owner.",
            include_in_schema=False,
        ),
    ] = None,
) -> FileResponse:
    if not x_user_id or not x_user_id.strip():
        raise HTTPException(status_code=403, detail="User ID required")

    user_id = x_user_id.strip()

    async with downloader.async_state_lock:
        job = downloader.jobs.get(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if job.user_id != user_id:
            # Return 404 instead of 403 to avoid confirming the job exists
            # to a caller who does not own it.
            raise HTTPException(status_code=404, detail="Job not found")

        if job.status != JobStatus.SUCCESS.value:
            raise HTTPException(
                status_code=400,
                detail="Job has not completed successfully yet",
            )

        output_path = job.output_path
        filename    = job.filename
        video_title = job.video_title

    # Path checks happen outside the lock — blocking I/O must not hold it.
    if not output_path:
        raise HTTPException(status_code=404, detail="Output path is not set for this job")

    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="File not found or has expired")

    download_name = _resolve_download_name(job_id, filename, video_title)

    logger.info(
        "File download | job=%s  user=%s  file=%s",
        job_id, user_id, download_name,
    )

    return FileResponse(
        path=output_path,
        filename=download_name,
        media_type="application/octet-stream",
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_download_name(job_id: str, filename: str | None, video_title: str | None) -> str:
    """
    Determine the filename shown to the user in their browser's Save dialog.

    Priority:
        1. Sanitised video title + extension from the stored filename.
        2. Stored filename as-is.
        3. Fallback: ``{job_id}.mp4``.
    """
    if filename and video_title:
        ext = os.path.splitext(filename)[1] or ".mp4"
        return sanitize_filename(video_title) + ext

    if filename:
        return filename

    return f"{job_id}.mp4"