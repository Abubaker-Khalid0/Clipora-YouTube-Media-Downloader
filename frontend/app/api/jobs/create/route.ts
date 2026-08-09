import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch, sanitizeBackendError } from '@/lib/backend'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DownloadMode = 'video' | 'audio' | 'thumbnail'
type VideoType = 'video_audio' | 'video_only' | 'audio_only'
type ThumbnailFormat = 'jpg' | 'png'

interface CreateJobBody {
  jobId?: string
  url: string
  mode: DownloadMode
  quality: string | null
  trimEnabled: boolean
  trimStart: number | null
  trimEnd: number | null
  videoType?: VideoType
  thumbnailFormat?: ThumbnailFormat
  videoTitle?: string
  thumbnailUrl?: string
}

const VALID_MODES: readonly DownloadMode[] = ['video', 'audio', 'thumbnail']
const VALID_VIDEO_TYPES: readonly VideoType[] = ['video_audio', 'video_only', 'audio_only']
const VALID_THUMBNAIL_FORMATS: readonly ThumbnailFormat[] = ['jpg', 'png']
const VALID_QUALITIES: readonly string[] = ['best', '144', '240', '360', '480', '720', '1080', '1440', '2160']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function secondsToTimecode(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s) || s < 0) return '00:00:00'
  const total = Math.floor(s)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function normalizeQuality(raw: string | null, mode: DownloadMode): string {
  if (mode !== 'video') return 'best'
  const stripped = (raw ?? 'best').replace(/p$/i, '').trim()
  return VALID_QUALITIES.includes(stripped) ? stripped : 'best'
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, data: null, error }, { status: 400 })
}

// ---------------------------------------------------------------------------
// POST /api/jobs/create
//
// No auth or credits — just validate and forward to backend.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, RATE_LIMITS.JOB_CREATE)
  if (!rateLimit.success) return rateLimitResponse(rateLimit.retryAfter)

  // ── Parse + validate ────────────────────────────────────────────────────
  let body: CreateJobBody
  try {
    body = (await request.json()) as CreateJobBody
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body.url || !body.mode) {
    return badRequest('url and mode are required')
  }

  if (!VALID_MODES.includes(body.mode)) {
    return badRequest('mode must be video, audio, or thumbnail')
  }

  if (body.mode === 'video') {
    const vt = body.videoType ?? 'video_audio'
    if (!VALID_VIDEO_TYPES.includes(vt)) {
      return badRequest('videoType must be video_audio or video_only')
    }
  }

  if (body.mode === 'thumbnail') {
    const fmt = body.thumbnailFormat ?? 'jpg'
    if (!VALID_THUMBNAIL_FORMATS.includes(fmt)) {
      return badRequest('thumbnailFormat must be jpg or png')
    }
  }

  if (body.trimEnabled && body.mode !== 'video') {
    return badRequest('Trim is only supported for video mode')
  }

  if (body.videoType === 'audio_only' && !body.trimEnabled) {
    return badRequest('audio_only output type requires trim to be enabled')
  }

  if (body.trimEnabled) {
    const start = body.trimStart ?? 0
    const end = body.trimEnd ?? 0
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return badRequest('trimStart and trimEnd must be numbers')
    }
    if (end <= 0 || start >= end) {
      return badRequest('trimEnd must be greater than trimStart')
    }
  }

  const quality = normalizeQuality(body.quality, body.mode)
  const trimEnabled = body.trimEnabled ?? false

  // ── Forward to FastAPI backend ──────────────────────────────────────────
  const jobId = body.jobId ?? crypto.randomUUID()

  try {
    const backendPayload: Record<string, unknown> = {
      job_id: jobId,
      url: body.url,
      mode: body.mode,
      user_id: '00000000-0000-0000-0000-000000000001',
      quality,
    }

    if (body.mode === 'video') {
      backendPayload.video_type = body.videoType ?? 'video_audio'
    }

    if (body.mode === 'thumbnail') {
      backendPayload.thumbnail_format = body.thumbnailFormat ?? 'jpg'
    }

    if (trimEnabled) {
      backendPayload.trim_enabled = true
      backendPayload.trim_start = secondsToTimecode(body.trimStart)
      backendPayload.trim_end = secondsToTimecode(body.trimEnd)
    } else {
      backendPayload.trim_enabled = false
    }

    await proxyFetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendPayload),
    })
  } catch (err) {
    console.error('[API Proxy] POST /api/jobs/create failed', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
      time: new Date().toISOString(),
    })

    const { userMessage, status } = sanitizeBackendError(err)
    return NextResponse.json(
      { success: false, data: null, error: userMessage },
      { status }
    )
  }

  return NextResponse.json(
    { success: true, data: { jobId }, error: null },
    { status: 201 }
  )
}
