"""
services/cleanup.py — Background service that purges expired temporary files.
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# Files with this name are never deleted (used to keep the temp dir in git).
_GITKEEP = ".gitkeep"


class CleanupService:
    """
    Periodically deletes files older than ``file_expiry_seconds`` from ``temp_dir``.

    Files belonging to an in-progress job are always skipped to avoid
    corrupting an active download.  A file is considered "owned" by a job
    when its stem (after stripping the ``_trimmed`` suffix) matches a job ID
    whose status is still ``"processing"``.
    """

    def __init__(
        self,
        temp_dir: Path,
        cleanup_interval_seconds: int = 300,
        file_expiry_seconds: int = 1800,
        jobs_store: dict | None = None,
    ) -> None:
        self._temp_dir                  = temp_dir
        self._cleanup_interval_seconds  = cleanup_interval_seconds
        self._file_expiry_seconds       = file_expiry_seconds
        self._jobs_store                = jobs_store

        self._thread:  threading.Thread | None = None
        self._stop_event                       = threading.Event()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background cleanup thread. Idempotent."""
        if self._thread is not None and self._thread.is_alive():
            logger.warning("CleanupService is already running — ignoring start()")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="clipora-cleanup",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "CleanupService started | interval=%ss  expiry=%ss",
            self._cleanup_interval_seconds,
            self._file_expiry_seconds,
        )

    def stop(self, timeout: float = 5.0) -> None:
        """Signal the background thread to stop and wait for it to exit."""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            if self._thread.is_alive():
                logger.warning("CleanupService thread did not exit within %.1fs", timeout)
        logger.info("CleanupService stopped")

    def cleanup_now(self) -> int:
        """
        Synchronously delete all expired files right now.

        Safe to call from any thread at any time.  Returns the number of
        files deleted.
        """
        return self._run_cleanup()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _loop(self) -> None:
        """Background thread body — sleeps between cleanup passes."""
        while not self._stop_event.wait(timeout=self._cleanup_interval_seconds):
            self._run_cleanup()

    def _active_job_ids(self) -> frozenset[str]:
        """
        Return IDs of jobs that are still processing.

        Reads the jobs store without a lock.  The worst-case outcome is that
        a file belonging to a *just-finished* job gets an extra cleanup pass
        one interval later — acceptable given the expiry window is 30 minutes.
        The reverse risk (deleting a file for a job that just *started*) is
        avoided because the job is inserted into the store before the download
        thread is launched.
        """
        if not self._jobs_store:
            return frozenset()
        return frozenset(
            job_id
            for job_id, job in self._jobs_store.items()
            if job.status == "processing"
        )

    def _run_cleanup(self) -> int:
        """
        Core cleanup logic shared by the background loop and cleanup_now().

        Returns the number of files deleted.
        """
        if not self._temp_dir.exists():
            return 0

        now             = time.time()
        active_ids      = self._active_job_ids()
        deleted_count   = 0

        for file_path in self._temp_dir.glob("*"):
            if not file_path.is_file() or file_path.name == _GITKEEP:
                continue

            stem = file_path.stem.removesuffix("_trimmed")
            if stem in active_ids:
                logger.debug("Skipping active-job file: %s", file_path.name)
                continue

            try:
                age = now - file_path.stat().st_mtime
                if age > self._file_expiry_seconds:
                    file_path.unlink(missing_ok=True)
                    deleted_count += 1
                    logger.debug("Deleted expired file: %s (age=%.0fs)", file_path.name, age)
            except OSError as exc:
                logger.warning("Could not delete %s: %s", file_path, exc)

        if deleted_count:
            logger.info("Cleanup pass complete: %d file(s) deleted", deleted_count)

        return deleted_count