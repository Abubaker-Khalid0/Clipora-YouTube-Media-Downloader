import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── YouTube URL Validation ───────────────────────────────────────────────────
// Covers: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, mobile URLs
export const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

export function extractYouTubeId(url: string): string | null {
  return url.match(YOUTUBE_REGEX)?.[1] ?? null
}

// ─── Quality Normalizer ───────────────────────────────────────────────────────
/**
 * Strips the trailing 'p' suffix (case-insensitive) and trims whitespace.
 * Use this before any quality string comparison — never compare raw strings.
 *
 * "1080p" → "1080"   "2160P" → "2160"   "1080" → "1080"
 */
export function normalizeQuality(quality: string): string {
  return quality.replace(/p$/i, '').trim()
}

// ─── Job mode ─────────────────────────────────────────────────────────────────
/**
 * The output modes the backend accepts, mirroring `DownloadMode` in
 * backend/models/schemas.py. Transcript is deliberately absent: it is served by
 * /api/transcript, not the job pipeline, and sending mode:'transcript' to
 * /api/jobs/create is rejected as an invalid mode.
 */
export type JobMode = 'video' | 'audio' | 'thumbnail'

// ─── File Size Formatter ──────────────────────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// ─── Relative Time Formatter ─────────────────────────────────────────────────
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ─── File Expiry Check ───────────────────────────────────────────────────────
// Files expire 30 minutes after creation on the backend
export function isFileExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > 30 * 60 * 1000
}
