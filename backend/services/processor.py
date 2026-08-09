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
# Raised from 300s: trimming now re-encodes for an accurate cut, so a long or
# high-resolution segment takes materially longer than a stream copy did.
_TRIM_TIMEOUT_SECONDS:      int = 900
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

def timecode_to_seconds(timecode: str) -> int:
    """Convert ``HH:MM:SS`` to whole seconds. Returns 0 on malformed input."""
    try:
        parts = [int(p) for p in timecode.strip().split(":")]
    except ValueError:
        return 0
    if len(parts) != 3:
        return 0
    hours, minutes, seconds = parts
    return hours * 3600 + minutes * 60 + seconds


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
    Trim a video or audio file to [start, end], accurate to the requested second.

    Args:
        input_path:  Absolute path to the source file.
        start:       Start timestamp in HH:MM:SS format.
        end:         End timestamp in HH:MM:SS format.
        output_path: Absolute path for the trimmed output file. Must be an
                     MP4-family container (.mp4 / .m4a) — see below.
        keep_audio:  When False, the audio stream is dropped (-an).
        keep_video:  When False, the video stream is dropped (-vn).

    Returns:
        (True, None) on success.
        (False, error_message) on failure.

    Notes:
        This used to run ``-ss`` before ``-i`` together with ``-c copy``. Stream
        copy cannot cut inside a GOP, so the start snapped back to the preceding
        keyframe and the clip came out longer than asked: a 5s–12s request
        produced 9.6s of video, because the nearest keyframe before 5s sat at
        ~2.4s. Re-encoding is the only way to honour an arbitrary in-point, so
        the streams are decoded and re-encoded here.

        ``-t`` (duration) is used rather than ``-to`` (stop timestamp): combined
        with an input-side ``-ss`` the meaning of ``-to`` depends on whether
        timestamps were rebased, which is exactly the ambiguity that hid this bug.
    """
    if not check_ffmpeg():
        return False, "FFmpeg is required for trimming but is not installed"

    duration = timecode_to_seconds(end) - timecode_to_seconds(start)
    if duration <= 0:
        return False, "Trim end must be greater than trim start"

    cmd = [
        "ffmpeg",
        # Before -i: ffmpeg still seeks fast, then decodes and drops frames up to
        # the exact in-point because the output is re-encoded.
        "-ss", start,
        "-i", input_path,
        "-t", str(duration),
    ]

    if keep_video:
        cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
    else:
        cmd.append("-vn")

    if keep_audio:
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    else:
        cmd.append("-an")

    cmd.extend(["-movflags", "+faststart", "-y", output_path])

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