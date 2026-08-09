"""
services/transcript.py — YouTube transcript fetching service.

Wraps the `youtube-transcript-api` library and provides clean
data structures for the router layer.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    CouldNotRetrieveTranscript,
    InvalidVideoId,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class SnippetResult:
    text: str
    start: float
    duration: float


@dataclass
class LanguageResult:
    code: str
    name: str
    is_generated: bool


@dataclass
class TranscriptResult:
    snippets: list[SnippetResult]
    available_languages: list[LanguageResult]
    language: str
    language_code: str
    is_generated: bool
    video_id: str


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_ytt_api = YouTubeTranscriptApi()


def fetch_transcript(video_id: str, lang: str = "en") -> TranscriptResult:
    """
    Fetch the transcript for a YouTube video.

    Args:
        video_id: YouTube video ID (e.g. 'dQw4w9WgXcQ').
        lang:     Preferred language code (e.g. 'en', 'ar', 'ko').

    Returns:
        TranscriptResult with snippets, available languages, and metadata.

    Raises:
        ValueError: When transcript is unavailable or video is invalid.
        ConnectionError: On network failures.
    """
    logger.info("Fetching transcript for video=%s lang=%s", video_id, lang)

    try:
        # 1) List all available transcripts
        transcript_list = _ytt_api.list(video_id)

        # 2) Collect available languages
        available_languages: list[LanguageResult] = []
        for t in transcript_list:
            available_languages.append(
                LanguageResult(
                    code=t.language_code,
                    name=t.language,
                    is_generated=t.is_generated,
                )
            )

        # 3) Find the requested language (fallback to first available)
        try:
            transcript = transcript_list.find_transcript([lang])
        except NoTranscriptFound:
            # Fallback: try English, then take whatever is available
            try:
                transcript = transcript_list.find_transcript(["en"])
            except NoTranscriptFound:
                # Take the first available transcript
                transcript = next(iter(transcript_list))

        # 4) Fetch the actual transcript data
        fetched = transcript.fetch()

        # 5) Convert to our result type
        snippets: list[SnippetResult] = []
        for snippet in fetched:
            snippets.append(
                SnippetResult(
                    text=snippet.text,
                    start=snippet.start,
                    duration=snippet.duration,
                )
            )

        result = TranscriptResult(
            snippets=snippets,
            available_languages=available_languages,
            language=transcript.language,
            language_code=transcript.language_code,
            is_generated=transcript.is_generated,
            video_id=video_id,
        )

        logger.info(
            "Transcript fetched: video=%s lang=%s snippets=%d",
            video_id,
            transcript.language_code,
            len(snippets),
        )
        return result

    except TranscriptsDisabled:
        raise ValueError("Transcripts are disabled for this video.")
    except InvalidVideoId:
        raise ValueError("Invalid video ID provided.")
    except VideoUnavailable:
        raise ValueError("This video is unavailable or does not exist.")
    except CouldNotRetrieveTranscript as exc:
        logger.warning("Could not retrieve transcript for %s: %s", video_id, exc)
        raise ValueError(f"Could not retrieve transcript: {exc}")
    except Exception as exc:
        logger.error("Unexpected transcript error for %s: %s", video_id, exc, exc_info=True)
        raise ConnectionError(f"Failed to fetch transcript: {exc}")
