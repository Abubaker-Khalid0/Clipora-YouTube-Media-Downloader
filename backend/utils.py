"""
utils.py — Shared utility functions for the Clipora backend.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# YouTube URL validation
# ---------------------------------------------------------------------------

_VALID_YOUTUBE_PATTERNS: list[str] = [
    r"(?:https?://)?(?:www\.)?youtube\.com/watch\?(?:[^&]*&)*v=[\w-]+",
    r"(?:https?://)?(?:www\.)?youtu\.be/[\w-]+",
    r"(?:https?://)?(?:www\.)?youtube\.com/shorts/[\w-]+",
    r"(?:https?://)?(?:www\.)?youtube\.com/embed/[\w-]+",
    r"(?:https?://)?(?:www\.)?youtube\.com/live/[\w-]+",
]

_PLAYLIST_PATTERNS: list[str] = [
    r"(?:https?://)?(?:www\.)?youtube\.com/playlist\?list=",
    r"(?:https?://)?(?:www\.)?youtube\.com/channel/",
    r"(?:https?://)?(?:www\.)?youtube\.com/@[\w-]+/videos",
]

_PLAYLIST_PARAM_RE = re.compile(r"[&?]list=[^&]*")
_INVALID_CHARS_RE  = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def validate_youtube_url(url: str) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Validate that a URL points to a single YouTube video (not a playlist or channel).

    Returns:
        (True,  None,          cleaned_url) — valid; always use cleaned_url downstream.
        (False, error_message, None)        — invalid.

    Cleaning steps applied to valid URLs:
        - Strips leading/trailing whitespace.
        - Removes the ``list=`` query parameter from mixed video+playlist URLs.
    """
    if not url or not url.strip():
        return False, "URL is required", None

    url = url.strip()

    if not url.startswith(("http://", "https://")):
        return False, "URL must start with http:// or https://", None

    for pattern in _PLAYLIST_PATTERNS:
        if re.search(pattern, url):
            return (
                False,
                "Single video URLs only. Playlists and channels are not supported.",
                None,
            )

    for pattern in _VALID_YOUTUBE_PATTERNS:
        if re.search(pattern, url):
            if "list=" in url.lower():
                url = _PLAYLIST_PARAM_RE.sub("", url).rstrip("?&")
            return True, None, url

    return False, "Invalid YouTube URL format", None


# ---------------------------------------------------------------------------
# Filename sanitisation
# ---------------------------------------------------------------------------

_MAX_FILENAME_LENGTH = 200


def sanitize_filename(filename: str) -> str:
    """
    Remove characters that are invalid in filenames on Windows / Linux / macOS
    and truncate the stem so the total length stays within _MAX_FILENAME_LENGTH.
    """
    if not filename or not filename.strip():
        return "file"

    filename = _INVALID_CHARS_RE.sub("_", filename).strip(". ")

    if not filename:
        return "file"

    if len(filename) <= _MAX_FILENAME_LENGTH:
        return filename

    p = Path(filename)
    max_stem = _MAX_FILENAME_LENGTH - len(p.suffix)
    return p.stem[:max_stem] + p.suffix


# ---------------------------------------------------------------------------
# Error message formatting
# ---------------------------------------------------------------------------

_ERROR_MAP: list[tuple[tuple[str, ...], str]] = [
    (
        ("ffmpeg", "ffprobe"),
        "FFmpeg is not installed. Please install it from https://ffmpeg.org/download.html",
    ),
    (
        ("members-only",),
        "This video is members-only. It requires a paid channel membership and cannot be downloaded.",
    ),
    (
        ("requested format is not available",),
        "No matching stream was found for this video. Try a different quality.",
    ),
    (
        ("merge",),
        "Failed to merge video and audio. Make sure FFmpeg is installed.",
    ),
    (
        ("private video",),
        "This video is private and cannot be accessed.",
    ),
    (
        ("video unavailable", "not available"),
        "This video is unavailable or has been deleted.",
    ),
    (
        ("copyright",),
        "This video is blocked due to copyright restrictions.",
    ),
    (
        ("network", "connection"),
        "Network connection error. Please check your internet.",
    ),
    (
        ("sign in", "bot"),
        "YouTube is requesting verification. Try again in a moment.",
    ),
    (
        ("cookies",),
        "Cookie error. Most videos work without cookies.",
    ),
    (
        ("age", "restrict"),
        "This video is age-restricted and cannot be downloaded.",
    ),
]


# Strips yt-dlp's internal prefix, e.g. "ERROR: [youtube] dQw4w9WgXcQ: real message"
_YTDLP_NOISE_RE = re.compile(r"^\s*ERROR:\s*(?:\[[^\]]+\]\s*)?(?:[\w-]{6,}:\s*)?", re.IGNORECASE)


def format_error_message(error: Exception) -> str:
    """
    Map known yt-dlp / FFmpeg error strings to user-friendly messages.
    Falls back to the original message with yt-dlp's internal prefix stripped,
    so video IDs and extractor names are never shown to the user.
    """
    raw = str(error)
    lowered = raw.lower()

    for keywords, message in _ERROR_MAP:
        if all(kw in lowered for kw in keywords):
            return message

    cleaned = _YTDLP_NOISE_RE.sub("", raw).strip()
    return cleaned or raw


# ---------------------------------------------------------------------------
# Time helpers  (shared between routers and downloader)
# ---------------------------------------------------------------------------

def time_to_seconds(time_str: str) -> int:
    """Convert ``H:MM:SS`` or ``HH:MM:SS`` to total seconds. Returns 0 on error."""
    try:
        parts = time_str.split(":")
        h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
        return h * 3600 + m * 60 + s
    except (ValueError, IndexError, AttributeError):
        return 0