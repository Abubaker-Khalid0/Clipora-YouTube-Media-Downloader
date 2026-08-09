"""
services/downloader.py — yt-dlp orchestration: video analysis and download worker.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import glob
import logging
import os
import threading
import traceback
from pathlib import Path
from typing import Optional

import yt_dlp
from yt_dlp.utils import DownloadError, ExtractorError

from models.schemas import AnalyzeData, Job, JobStage, JobStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TEMP_DIR         = Path(os.getenv("STORAGE_PATH", "storage/temp"))
DOWNLOAD_TIMEOUT = int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "1800"))
YTDLP_COOKIES    = os.getenv("YTDLP_COOKIES", "").strip()

TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Extension priority used by find_actual_output_file().
# Earlier position = higher preference when multiple candidates exist.
_PREFERRED_EXTENSIONS: list[str] = [
    ".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v",
    ".mp3", ".m4a", ".opus", ".ogg", ".weba",
    ".jpg", ".png",
]
_PREFERRED_EXT_SET:  frozenset[str] = frozenset(_PREFERRED_EXTENSIONS)
_PARTIAL_EXT_SET:    frozenset[str] = frozenset({".part", ".ytdl", ".temp", ".json"})

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

jobs:             dict[str, Job] = {}
state_lock:       threading.Lock = threading.Lock()
async_state_lock: asyncio.Lock   = asyncio.Lock()
is_downloading:   bool           = False


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _apply_cookies(opts: dict) -> None:
    if YTDLP_COOKIES and os.path.exists(YTDLP_COOKIES):
        opts["cookiefile"] = YTDLP_COOKIES
        logger.debug("Using cookies file: %s", YTDLP_COOKIES)


def _base_ydl_opts() -> dict:
    return {
        "quiet":            True,
        "no_warnings":      True,
        "no_color":         True,
        "ignoreerrors":     False,
        "socket_timeout":   30,
        "retries":          3,
        "fragment_retries": 3,
        "http_chunk_size":  10_485_760,  # 10 MB
    }


_TRANSPORT_ERROR_MARKERS: tuple[str, ...] = (
    "getaddrinfo",
    "timed out",
    "timeout",
    "connection reset",
    "connection refused",
    "connection aborted",
    "temporary failure in name resolution",
    "unable to download webpage",
    "network is unreachable",
    "ssl",
)


def _is_transport_error(message: str) -> bool:
    """True when a yt-dlp DownloadError reflects a network failure, not a content restriction."""
    lowered = message.lower()
    return any(marker in lowered for marker in _TRANSPORT_ERROR_MARKERS)


def _extract_best_thumbnail(thumbnails: list[dict]) -> str:
    if not thumbnails:
        return ""
    try:
        ranked = sorted(
            thumbnails,
            key=lambda t: (t.get("width") or 0) * (t.get("height") or 0),
            reverse=True,
        )
        return ranked[0].get("url", "")
    except (TypeError, KeyError):
        return thumbnails[0].get("url", "") if thumbnails else ""


# ---------------------------------------------------------------------------
# Analyze
# ---------------------------------------------------------------------------

def analyze_video(url: str) -> AnalyzeData:
    """
    Extract metadata for a YouTube URL without downloading any media.

    Runs synchronously — callers inside async context must use run_in_executor().

    Raises:
        ValueError       – Video unavailable or metadata extraction failed.
        ConnectionError  – Network / DNS error.
        RuntimeError     – Unexpected yt-dlp error.
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string")

    opts = {
        **_base_ydl_opts(),
        "skip_download": True,
        # Do NOT request any specific format during analysis — we only need metadata.
        "format": None,
        # "format": None still runs yt-dlp's default format selector, which raises
        # "Requested format is not available" for videos whose streams it cannot
        # match (DRM, storyboard-only, SABR-served). Metadata is unaffected, so we
        # suppress that failure here and validate the format list ourselves below.
        "ignore_no_formats_error": True,
        # Ensure no post-processing or format selection triggers a download attempt.
        "extract_flat": False,
    }
    _apply_cookies(opts)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if info is None:
            raise ValueError("Could not extract video information. The video may be unavailable or private.")

        video_id = info.get("id")
        if not video_id:
            raise ValueError("Video ID not found in extracted metadata")

        duration = info.get("duration")
        duration_seconds = int(duration) if isinstance(duration, (int, float)) else 0
        if duration is None:
            logger.warning("Video %s has no duration (possibly a live stream)", video_id)

        formats = [f for f in info.get("formats", []) if isinstance(f, dict)]

        # ignore_no_formats_error lets extraction succeed with an empty format list,
        # so surface that as a clear error instead of returning an unusable video.
        if not formats:
            raise ValueError(
                "No downloadable streams were found for this video. "
                "It may be DRM-protected, members-only, or region-blocked."
            )

        available_qualities: list[int] = sorted(
            {
                int(f["height"])
                for f in formats
                if f.get("height") and f.get("vcodec", "none") != "none"
            },
            reverse=True,
        )

        audio_formats = [
            f for f in formats
            if f.get("acodec", "none") != "none" and f.get("vcodec", "none") == "none"
        ]

        best_audio_label   = ""
        best_audio_bitrate: Optional[int] = None

        if audio_formats:
            try:
                best = max(audio_formats, key=lambda f: f.get("abr") or 0)
                ext   = best.get("ext", "")
                codec = (best.get("acodec") or "").split(".")[0]
                best_audio_label   = f"{ext}/{codec}" if ext and codec else ""
                abr = best.get("abr")
                best_audio_bitrate = int(abr) if abr is not None else None
            except (ValueError, TypeError) as exc:
                logger.warning("Could not determine best audio format: %s", exc)

        channel = info.get("uploader") or info.get("channel") or "Unknown Channel"

        logger.info("Analyzed video %s — %s", video_id, info.get("title", ""))

        return AnalyzeData(
            video_id=video_id,
            title=info.get("title") or "Unknown Title",
            duration_seconds=duration_seconds,
            channel=channel,
            thumbnail_url=_extract_best_thumbnail(info.get("thumbnails") or []),
            available_qualities=available_qualities,
            best_audio_label=best_audio_label,
            best_audio_bitrate=best_audio_bitrate,
        )

    except (ExtractorError, ValueError) as exc:
        logger.error("Extraction failed for %s: %s", url, exc)
        raise ValueError(f"Could not extract video information: {exc}") from exc
    except DownloadError as exc:
        # DownloadError covers both transport failures and content restrictions
        # (members-only, private, geo-blocked). Labelling everything "Network error"
        # misleads the user, so classify before re-raising.
        message = str(exc)
        if _is_transport_error(message):
            logger.error("Network error for %s: %s", url, message)
            raise ConnectionError(message) from exc
        logger.error("Video not retrievable %s: %s", url, message)
        raise ValueError(message) from exc
    except Exception as exc:
        logger.error("Unexpected error analyzing %s: %s", url, exc, exc_info=True)
        raise RuntimeError(f"Unexpected error during video analysis: {exc}") from exc


# ---------------------------------------------------------------------------
# Output file resolution
# ---------------------------------------------------------------------------

def find_actual_output_file(base_path: str, job_id: str, output_dir: str) -> Optional[str]:
    """
    Locate the file yt-dlp actually wrote after post-processing.

    yt-dlp may change the extension during merging (e.g. .webm → .mp4), so
    ``base_path`` (the outtmpl value) is not always the final path.

    Selection priority:
        1. ``base_path`` if it exists on disk (fast path).
        2. All ``{job_id}.*`` files in ``output_dir``, excluding partials.
        3. Among candidates: earliest position in _PREFERRED_EXTENSIONS wins;
           ties broken by larger file size (more complete output).
    """
    if base_path and os.path.exists(base_path):
        return base_path

    candidates = [
        Path(p)
        for p in glob.glob(os.path.join(output_dir, f"{job_id}.*"))
        if Path(p).suffix not in _PARTIAL_EXT_SET
    ]

    if not candidates:
        return None
    if len(candidates) == 1:
        return str(candidates[0])

    def _sort_key(p: Path) -> tuple[int, int]:
        ext_rank = (
            _PREFERRED_EXTENSIONS.index(p.suffix)
            if p.suffix in _PREFERRED_EXT_SET
            else len(_PREFERRED_EXTENSIONS)
        )
        size = p.stat().st_size if p.exists() else 0
        return (ext_rank, -size)

    selected = sorted(candidates, key=_sort_key)[0]
    logger.warning(
        "Multiple output files for job %s: %s — selected %s",
        job_id,
        [p.name for p in candidates],
        selected.name,
    )
    return str(selected)


# ---------------------------------------------------------------------------
# yt-dlp options builder
# ---------------------------------------------------------------------------

def _build_ydl_opts(job: Job) -> dict:
    opts = {
        **_base_ydl_opts(),
        "outtmpl": str(TEMP_DIR / f"{job.id}.%(ext)s"),
    }
    _apply_cookies(opts)

    if job.mode == "thumbnail":
        opts["skip_download"]  = True
        opts["writethumbnail"] = True
        return opts

    if job.mode == "audio":
        opts["format"] = "bestaudio/best"
        return opts

    # video mode
    # audio_only + trim: download audio stream only (video is not needed)
    if job.video_type == "audio_only":
        opts["format"] = "bestaudio/best"
        return opts

    try:
        height = int(job.quality)
    except ValueError:
        height = None

    if height:
        if job.video_type == "video_audio":
            opts["format"] = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
        else:
            opts["format"] = f"bestvideo[height<={height}]/bestvideo/best[height<={height}]"
    else:
        if job.video_type == "video_audio":
            opts["format"] = "bestvideo+bestaudio/best"
        else:
            opts["format"] = "bestvideo/bestvideo"

    return opts


# ---------------------------------------------------------------------------
# Progress hooks
# ---------------------------------------------------------------------------

def _make_progress_hook(job: Job, trim_enabled: bool, needs_merge: bool):
    def hook(d: dict) -> None:
        status = d.get("status")
        if status == "downloading":
            try:
                if "_percent_str" in d:
                    pct = float(d["_percent_str"].strip().rstrip("%"))
                elif d.get("downloaded_bytes") and d.get("total_bytes"):
                    pct = d["downloaded_bytes"] / d["total_bytes"] * 100
                else:
                    return
                cap = 85 if trim_enabled else 95
                with state_lock:
                    job.progress = min(int(pct), cap)
                    job.stage    = JobStage.DOWNLOADING.value
            except (ValueError, TypeError):
                pass

        elif status == "finished":
            with state_lock:
                job.progress = 90 if trim_enabled else 96
                if job.mode == "audio":
                    job.stage = JobStage.FINALIZING.value
                elif needs_merge and not trim_enabled:
                    job.stage = JobStage.MERGING.value
                else:
                    job.stage = JobStage.FINALIZING.value

    return hook


def _make_postprocessor_hook(job: Job):
    def hook(d: dict) -> None:
        with state_lock:
            if d.get("status") == "started":
                job.progress = 97
                job.stage    = JobStage.MERGING.value
            elif d.get("status") == "finished":
                job.progress = 99
                job.stage    = JobStage.FINALIZING.value
    return hook


# ---------------------------------------------------------------------------
# Download worker
# ---------------------------------------------------------------------------

def _do_download(job_id: str) -> None:
    """
    Core download worker — runs in a dedicated thread via download_video().

    All state mutations go through ``state_lock`` so the async route handlers
    always see a consistent snapshot when they acquire ``async_state_lock``.
    """
    from services.processor import check_ffmpeg, convert_thumbnail, trim_media

    with state_lock:
        job = jobs.get(job_id)
        if not job:
            logger.error("Worker started for unknown job %s", job_id)
            return
        job.stage = JobStage.INITIALIZING.value

    logger.info("Job %s | mode=%s | url=%s", job_id, job.mode, job.url)

    try:
        # ── 1. Extract metadata ─────────────────────────────────────────
        with state_lock:
            job.stage = JobStage.EXTRACTING_INFO.value

        info_opts = {**_base_ydl_opts(), "skip_download": True}
        _apply_cookies(info_opts)

        with yt_dlp.YoutubeDL(info_opts) as ydl:
            info = ydl.extract_info(job.url, download=False)

        if info is None:
            raise ValueError("Could not extract video info. The video may be unavailable.")

        with state_lock:
            job.video_id    = info.get("id", job_id[:8])
            job.video_title = info.get("title", "Unknown")
            job.thumbnail_url = _extract_best_thumbnail(info.get("thumbnails") or [])

        # ── 2. Thumbnail mode ───────────────────────────────────────────
        if job.mode == "thumbnail":
            _handle_thumbnail(job, job_id)
            return

        # ── 3. Video / audio mode ───────────────────────────────────────
        ydl_opts    = _build_ydl_opts(job)
        format_str  = ydl_opts.get("format", "")
        needs_merge = "+" in format_str.split("/")[0] and job.mode != "audio"

        if needs_merge or job.trim_enabled:
            if not check_ffmpeg():
                raise RuntimeError("FFmpeg is required but is not installed")

        ydl_opts["progress_hooks"] = [_make_progress_hook(job, job.trim_enabled, needs_merge)]
        if needs_merge:
            ydl_opts["postprocessor_hooks"] = [_make_postprocessor_hook(job)]

        with state_lock:
            job.stage = JobStage.DOWNLOADING.value

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            download_info     = ydl.extract_info(job.url, download=True)
            expected_filename = ydl.prepare_filename(download_info)

        actual_file = find_actual_output_file(expected_filename, job_id, str(TEMP_DIR))
        if not actual_file or not os.path.exists(actual_file):
            raise FileNotFoundError("Downloaded file not found after yt-dlp completed")

        # ── 4. Trim ─────────────────────────────────────────────────────
        if job.trim_enabled:
            assert job.trim_start and job.trim_end, "trim_start/trim_end must be set when trim_enabled=True"

            with state_lock:
                job.progress = 90
                job.stage    = JobStage.TRIMMING.value

            # The trimmed file is re-encoded to H.264/AAC for an accurate cut, so
            # its container must be MP4-family. Reusing the source extension put
            # H.264 inside a WebM, which is not a valid combination.
            keep_video   = job.video_type != "audio_only"
            trimmed_ext  = ".mp4" if keep_video else ".m4a"
            trimmed_path = str(TEMP_DIR / f"{job_id}_trimmed{trimmed_ext}")

            success, err = trim_media(
                actual_file,
                job.trim_start,
                job.trim_end,
                trimmed_path,
                keep_audio=(job.video_type != "video_only"),
                keep_video=keep_video,
            )
            if not success:
                raise RuntimeError(f"Trim failed: {err}")

            actual_file = trimmed_path

            with state_lock:
                job.progress = 99
                job.stage    = JobStage.FINALIZING.value

        # ── 5. Finalise ─────────────────────────────────────────────────
        with state_lock:
            job.mark_success(
                output_path=actual_file,
                filename=os.path.basename(actual_file),
                file_size=os.path.getsize(actual_file),
            )

        logger.info("Job %s completed — %s", job_id, os.path.basename(actual_file))

    except Exception as exc:
        logger.error(
            "Job %s failed | %s: %s\n%s",
            job_id,
            type(exc).__name__,
            exc,
            traceback.format_exc(),
        )
        from utils import format_error_message
        with state_lock:
            failed_job = jobs.get(job_id)
            if failed_job:
                failed_job.mark_failed(format_error_message(exc))


def _handle_thumbnail(job: Job, job_id: str) -> None:
    from services.processor import convert_thumbnail

    with state_lock:
        job.stage = JobStage.DOWNLOADING_THUMBNAIL.value

    ydl_opts = _build_ydl_opts(job)
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([job.url])

    thumbnail_file = find_actual_output_file("", job_id, str(TEMP_DIR))
    if not thumbnail_file or not os.path.exists(thumbnail_file):
        raise FileNotFoundError("Thumbnail file not found after download")

    with state_lock:
        job.stage    = JobStage.CONVERTING_THUMBNAIL.value
        job.progress = 90

    converted, err = convert_thumbnail(thumbnail_file, job.thumbnail_format)
    if not converted or err:
        raise RuntimeError(err or "Thumbnail conversion failed")

    with state_lock:
        job.mark_success(
            output_path=converted,
            filename=os.path.basename(converted),
            file_size=os.path.getsize(converted),
        )

    logger.info("Job %s completed (thumbnail) — %s", job_id, os.path.basename(converted))


# ---------------------------------------------------------------------------
# Partial file cleanup
# ---------------------------------------------------------------------------

def _cleanup_partial_files(job_id: str) -> None:
    """Remove incomplete / temporary files left by a timed-out or cancelled download."""
    patterns = [
        str(TEMP_DIR / f"{job_id}.*"),
        str(TEMP_DIR / f"{job_id}_trimmed.*"),
    ]
    for pattern in patterns:
        for path in glob.glob(pattern):
            ext = Path(path).suffix.lower()
            if ext in _PARTIAL_EXT_SET or ext not in _PREFERRED_EXT_SET:
                try:
                    os.remove(path)
                    logger.info("Removed partial file: %s", path)
                except OSError as exc:
                    logger.warning("Could not remove partial file %s: %s", path, exc)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def download_video(job: Job) -> None:
    """
    Launch a background thread to download ``job``.

    The thread is wrapped in a ThreadPoolExecutor so we can impose a hard
    DOWNLOAD_TIMEOUT deadline.  On timeout the job is marked failed and
    ``is_downloading`` is reset, unblocking future job requests.
    """
    global is_downloading

    def worker() -> None:
        global is_downloading
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_download, job.id)
            try:
                future.result(timeout=DOWNLOAD_TIMEOUT)
            except concurrent.futures.TimeoutError:
                logger.error(
                    "Job %s timed out after %ds — marking failed",
                    job.id,
                    DOWNLOAD_TIMEOUT,
                )
                with state_lock:
                    timed_out = jobs.get(job.id)
                    if timed_out:
                        timed_out.mark_failed(
                            f"Download timed out after {DOWNLOAD_TIMEOUT // 60} minutes"
                        )
                _cleanup_partial_files(job.id)
            except Exception as exc:
                logger.error("Job %s worker error: %s", job.id, exc, exc_info=True)
            finally:
                with state_lock:
                    is_downloading = False

    threading.Thread(target=worker, name=f"clipora-download-{job.id}", daemon=True).start()