"""
models/schemas.py — Pydantic request/response models and Job dataclass.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DownloadMode(str, Enum):
    VIDEO     = "video"
    AUDIO     = "audio"
    THUMBNAIL = "thumbnail"


class VideoType(str, Enum):
    VIDEO_AUDIO = "video_audio"
    VIDEO_ONLY  = "video_only"
    AUDIO_ONLY  = "audio_only"


class ThumbnailFormat(str, Enum):
    JPG = "jpg"
    PNG = "png"


class JobStatus(str, Enum):
    PROCESSING = "processing"
    SUCCESS    = "success"
    FAILED     = "failed"


class JobStage(str, Enum):
    INITIALIZING          = "initializing"
    EXTRACTING_INFO       = "extracting_info"
    DOWNLOADING           = "downloading"
    DOWNLOADING_THUMBNAIL = "downloading_thumbnail"
    CONVERTING_THUMBNAIL  = "converting_thumbnail"
    MERGING               = "merging"
    TRIMMING              = "trimming"
    FINALIZING            = "finalizing"
    COMPLETED             = "completed"
    FAILED                = "failed"


# ---------------------------------------------------------------------------
# Shared config
# ---------------------------------------------------------------------------

class _BaseSchema(BaseModel):
    model_config = {
        "str_strip_whitespace": True,
        "frozen": False,
    }


# ---------------------------------------------------------------------------
# Analyze
# ---------------------------------------------------------------------------

class AnalyzeRequest(_BaseSchema):
    url: str = Field(..., min_length=10, max_length=2048)


class AnalyzeData(_BaseSchema):
    video_id:           str
    title:              str
    duration_seconds:   int   = Field(..., ge=0)
    channel:            str
    thumbnail_url:      str
    available_qualities: list[int]
    best_audio_label:   str
    best_audio_bitrate: Optional[int] = Field(default=None, ge=0)


class AnalyzeResponse(_BaseSchema):
    success: bool
    data:    AnalyzeData


# ---------------------------------------------------------------------------
# Transcript
# ---------------------------------------------------------------------------

class TranscriptRequest(_BaseSchema):
    video_id: str = Field(..., min_length=1, max_length=32)
    lang:     str = Field(default="en", max_length=10)


class TranscriptSnippet(_BaseSchema):
    text:     str
    start:    float = Field(..., ge=0)
    duration: float = Field(..., ge=0)


class TranscriptLanguageInfo(_BaseSchema):
    code:         str
    name:         str
    is_generated: bool


class TranscriptData(_BaseSchema):
    snippets:            list[TranscriptSnippet]
    available_languages: list[TranscriptLanguageInfo]
    language:            str
    language_code:       str
    is_generated:        bool
    video_id:            str


class TranscriptResponse(_BaseSchema):
    success: bool
    data:    TranscriptData


# ---------------------------------------------------------------------------
# Job create
# ---------------------------------------------------------------------------

class JobCreateRequest(_BaseSchema):
    job_id:           UUID
    url:              str            = Field(..., min_length=10, max_length=2048)
    mode:             DownloadMode
    user_id:          UUID
    video_type:       VideoType      = VideoType.VIDEO_AUDIO
    quality:          str            = Field(default="best", max_length=10)
    trim_enabled:     bool           = False
    trim_start:       str            = Field(default="00:00:00", pattern=r"^\d{1,2}:[0-5]\d:[0-5]\d$")
    trim_end:         str            = Field(default="00:00:00", pattern=r"^\d{1,2}:[0-5]\d:[0-5]\d$")
    thumbnail_format: ThumbnailFormat = ThumbnailFormat.JPG

    @field_validator("quality")
    @classmethod
    def validate_quality(cls, v: str) -> str:
        if v == "best":
            return v
        try:
            height = int(v)
            if height not in {144, 240, 360, 480, 720, 1080, 1440, 2160}:
                raise ValueError
        except ValueError:
            raise ValueError("quality must be 'best' or a valid height: 144/240/360/480/720/1080/1440/2160")
        return v

    @model_validator(mode="after")
    def validate_trim_logic(self) -> JobCreateRequest:
        if not self.trim_enabled:
            return self

        if self.mode != DownloadMode.VIDEO:
            raise ValueError("Trim is only supported for video mode")

        start_sec = _time_to_seconds(self.trim_start)
        end_sec   = _time_to_seconds(self.trim_end)

        if end_sec == 0:
            raise ValueError("trim_end must be greater than 00:00:00")
        if start_sec >= end_sec:
            raise ValueError("trim_end must be greater than trim_start")

        return self

    @model_validator(mode="after")
    def validate_mode_constraints(self) -> JobCreateRequest:
        if self.mode == DownloadMode.THUMBNAIL and self.trim_enabled:
            raise ValueError("Trim is not supported for thumbnail mode")
        if self.video_type == VideoType.AUDIO_ONLY and not self.trim_enabled:
            raise ValueError("audio_only output type requires trim to be enabled")
        return self


class JobCreateResponse(_BaseSchema):
    success: bool
    data:    dict[str, str]


# ---------------------------------------------------------------------------
# Job status
# ---------------------------------------------------------------------------

class JobStatusData(_BaseSchema):
    id:              str
    mode:            str
    status:          str
    stage:           str
    progress:        int
    video_id:        Optional[str] = None
    video_title:     Optional[str] = None
    filename:        Optional[str] = None
    file_size:       Optional[int] = None
    thumbnail_url:   Optional[str] = None
    resolution:      Optional[str] = None
    error_message:   Optional[str] = None
    created_at:      str
    finished_at:     Optional[str] = None


class JobStatusResponse(_BaseSchema):
    success: bool
    data:    JobStatusData


# ---------------------------------------------------------------------------
# Error
# ---------------------------------------------------------------------------

class ErrorResponse(_BaseSchema):
    success: bool  = False
    error:   str


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _time_to_seconds(time_str: str) -> int:
    """Convert HH:MM:SS or H:MM:SS to total seconds."""
    try:
        parts = time_str.split(":")
        h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
        return h * 3600 + m * 60 + s
    except (ValueError, IndexError):
        return 0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Job dataclass — internal in-memory state, never serialised to client as-is
# ---------------------------------------------------------------------------

@dataclass
class Job:
    id:               str
    url:              str
    mode:             str
    user_id:          str
    video_type:       str            = "video_audio"
    quality:          str            = "best"
    thumbnail_format: str            = "jpg"
    trim_enabled:     bool           = False
    trim_start:       Optional[str]  = None
    trim_end:         Optional[str]  = None

    status:           str            = JobStatus.PROCESSING.value
    stage:            str            = JobStage.INITIALIZING.value
    progress:         int            = 0

    video_id:         Optional[str]  = None
    video_title:      Optional[str]  = None
    filename:         Optional[str]  = None
    file_size:        Optional[int]  = None
    thumbnail_url:    Optional[str]  = None
    resolution:       Optional[str]  = None
    error_message:    Optional[str]  = None

    # output_path is intentionally excluded from all public serialisation methods.
    # It is a server-side filesystem path and must never reach the client.
    output_path:      Optional[str]  = None

    created_at:       str            = field(default_factory=_utc_now)
    finished_at:      Optional[str]  = None

    # ------------------------------------------------------------------
    # Public serialisation — safe for client consumption
    # ------------------------------------------------------------------

    def to_status_data(self) -> JobStatusData:
        """Return a typed, client-safe status snapshot (no filesystem paths)."""
        return JobStatusData(
            id=self.id,
            mode=self.mode,
            status=self.status,
            stage=self.stage,
            progress=self.progress,
            video_id=self.video_id,
            video_title=self.video_title,
            filename=self.filename,
            file_size=self.file_size,
            thumbnail_url=self.thumbnail_url,
            resolution=self.resolution,
            error_message=self.error_message,
            created_at=self.created_at,
            finished_at=self.finished_at,
        )

    def to_sse_dict(self) -> dict:
        """
        Minimal SSE payload.

        Race-safe: status="success" is checked first so the completion event
        is emitted even if stage hasn't been updated to "completed" yet.
        """
        if self.status == JobStatus.SUCCESS.value:
            return {
                "stage":   "complete",
                "percent": 100,
                "file_id": self.id,
            }

        if self.status == JobStatus.FAILED.value:
            return {
                "stage":   "error",
                "percent": self.progress,
                "message": self.error_message or "An error occurred",
            }

        return {
            "stage":   self.stage,
            "percent": self.progress,
            "message": self._stage_message(),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def mark_failed(self, message: str) -> None:
        self.status       = JobStatus.FAILED.value
        self.stage        = JobStage.FAILED.value
        self.error_message = message
        self.finished_at  = _utc_now()

    def mark_success(self, output_path: str, filename: str, file_size: int) -> None:
        self.status      = JobStatus.SUCCESS.value
        self.stage       = JobStage.COMPLETED.value
        self.progress    = 100
        self.output_path = output_path
        self.filename    = filename
        self.file_size   = file_size
        self.finished_at = _utc_now()

    def _stage_message(self) -> str:
        _messages: dict[str, str] = {
            JobStage.INITIALIZING.value:          "Initializing...",
            JobStage.EXTRACTING_INFO.value:       "Extracting video info...",
            JobStage.DOWNLOADING.value:           f"Downloading {self.progress}%...",
            JobStage.DOWNLOADING_THUMBNAIL.value: "Downloading thumbnail...",
            JobStage.CONVERTING_THUMBNAIL.value:  "Converting thumbnail...",
            JobStage.MERGING.value:               "Merging video and audio...",
            JobStage.TRIMMING.value:              "Trimming video...",
            JobStage.FINALIZING.value:            "Finalizing...",
            JobStage.COMPLETED.value:             "Complete!",
        }
        return _messages.get(self.stage, self.stage)