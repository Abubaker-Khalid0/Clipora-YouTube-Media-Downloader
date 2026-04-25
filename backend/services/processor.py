"""
services/processor.py — FFmpeg wrappers for trim, thumbnail conversion, and availability check.
"""

from __future__ import annotations

import logging
import os
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

# Cached after the first call to check_ffmpeg().
_ffmpeg_available: Optional[bool] = None

# Hard timeout for each FFmpeg subprocess.
_TRIM_TIMEOUT_SECONDS:      int = 300
_CONVERT_TIMEOUT_SECONDS:   int = 30
_VERSION_TIMEOUT_SECONDS:   int = 5

# Minimal safe environment for subprocess — avoids leaking secrets from os.environ.
_SAFE_ENV: dict[str, str] = {
    k: v for k, v in os.environ.items()
    if k in {"PATH", "HOME", "TEMP", "TMP", "TMPDIR", "SYSTEMROOT", "WINDIR"}
}


# ---------------------------------------------------------------------------
# Availability
# ---------------------------------------------------------------------------

def check_ffmpeg() -> bool:
    """Return True if ffmpeg is reachable on PATH. Result is cached process-wide."""
    global _ffmpeg_available
    if _ffmpeg_available is not None:
        return _ffmpeg_available
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=_VERSION_TIMEOUT_SECONDS,
            env=_SAFE_ENV,
        )
        _ffmpeg_available = result.returncode == 0
    except Exception:
        _ffmpeg_available = False

    logger.info("FFmpeg available: %s", _ffmpeg_available)
    return _ffmpeg_available


def reset_ffmpeg_cache() -> None:
    """Force re-detection of FFmpeg on next call to check_ffmpeg(). Useful in tests."""
    global _ffmpeg_available
    _ffmpeg_available = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _run(cmd: list[str], timeout: int) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=_SAFE_ENV,
    )


def _assert_output(path: str, label: str) -> Optional[str]:
    """Return an error string if the output file is missing or empty, else None."""
    if not os.path.exists(path):
        return f"{label}: output file not found at {path}"
    if os.path.getsize(path) == 0:
        return f"{label}: output file is empty"
    return None


# ---------------------------------------------------------------------------
# Trim
# ---------------------------------------------------------------------------

def trim_media(
    input_path: str,
    start: str,
    end: str,
    output_path: str,
    *,
    keep_audio: bool = True,
    keep_video: bool = True,
) -> tuple[bool, Optional[str]]:
    """
    Trim a video or audio file to [start, end] using stream copy.

    Args:
        input_path:  Absolute path to the source file.
        start:       Start timestamp in HH:MM:SS format.
        end:         End timestamp in HH:MM:SS format.
        output_path: Absolute path for the trimmed output file.
        keep_audio:  When False, the audio stream is dropped (-an).
        keep_video:  When False, the video stream is dropped (-vn).

    Returns:
        (True, None) on success.
        (False, error_message) on failure.

    Notes:
        - ``-ss`` placed before ``-i`` enables fast input seeking (keyframe-level).
          This is intentional: re-encoding for frame-accurate trim is left to
          the caller if needed.
        - ``-avoid_negative_ts make_zero`` prevents negative PTS values that
          break some players after a seek-based trim.
    """
    if not check_ffmpeg():
        return False, "FFmpeg is required for trimming but is not installed"

    cmd = [
        "ffmpeg",
        "-ss", start,
        "-to", end,
        "-i", input_path,
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
    ]

    if not keep_audio:
        cmd.append("-an")
    if not keep_video:
        cmd.append("-vn")

    cmd.extend(["-y", output_path])

    try:
        result = _run(cmd, _TRIM_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return False, f"Trim timed out after {_TRIM_TIMEOUT_SECONDS // 60} minutes"
    except Exception as exc:
        return False, f"Trim error: {exc}"

    if result.returncode != 0:
        stderr = result.stderr.strip()
        if "could not seek" in stderr.lower() or "keyframe" in stderr.lower():
            return False, "Trim failed: source file does not support keyframe seeking"
        return False, f"FFmpeg trim failed: {stderr}"

    err = _assert_output(output_path, "Trim")
    if err:
        return False, err

    return True, None


# ---------------------------------------------------------------------------
# Thumbnail conversion
# ---------------------------------------------------------------------------

def convert_thumbnail(
    input_path: str,
    output_format: str = "jpg",
) -> tuple[Optional[str], Optional[str]]:
    """
    Convert a thumbnail image to the requested format using FFmpeg.

    If FFmpeg is unavailable and the source file already has the target
    extension, the source path is returned as-is (no-op fast path).

    Args:
        input_path:    Absolute path to the downloaded thumbnail.
        output_format: Target format — ``"jpg"`` or ``"png"``.

    Returns:
        (output_path, None)  on success.
        (None, error_message) on failure.
    """
    output_format = output_format.lower().strip()
    target_ext    = f".{output_format}"
    output_path   = os.path.splitext(input_path)[0] + target_ext

    if not check_ffmpeg():
        src_ext = os.path.splitext(input_path)[1].lower()
        if src_ext == target_ext:
            return input_path, None
        return None, "FFmpeg is required for thumbnail conversion but is not installed"

    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vframes", "1",
        "-q:v", "2",
    ]

    if output_format == "png":
        cmd.extend(["-compression_level", "6"])

    cmd.extend(["-y", output_path])

    try:
        result = _run(cmd, _CONVERT_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return None, f"Thumbnail conversion timed out after {_CONVERT_TIMEOUT_SECONDS}s"
    except Exception as exc:
        return None, f"Thumbnail conversion error: {exc}"

    if result.returncode != 0:
        return None, f"Thumbnail conversion failed: {result.stderr.strip()}"

    err = _assert_output(output_path, "Thumbnail conversion")
    if err:
        return None, err

    # Remove the original file only when conversion produced a different path.
    if input_path != output_path:
        try:
            os.remove(input_path)
        except OSError as exc:
            logger.warning("Could not remove original thumbnail %s: %s", input_path, exc)

    return output_path, None