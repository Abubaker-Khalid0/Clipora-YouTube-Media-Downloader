import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch, sanitizeBackendError } from '@/lib/backend'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimiter'

/**
 * POST /api/analyze
 *
 * Proxies YouTube URL analysis to the FastAPI backend.
 * No auth required during development.
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, RATE_LIMITS.ANALYZE)
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.retryAfter)
  }

  let body: { url?: string }
  try {
    body = (await request.json()) as { url?: string }
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  if (!body.url) {
    return NextResponse.json(
      { success: false, data: null, error: 'URL is required' },
      { status: 400 }
    )
  }

  try {
    const backendRes = await proxyFetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 65_000)

    const envelope = (await backendRes.json()) as {
      success: boolean
      data: Record<string, unknown>
      error?: string
    }

    if (!envelope.success) {
      return NextResponse.json(
        { success: false, data: null, error: envelope.error ?? 'Analyze failed' },
        { status: 502 }
      )
    }

    const backendData = envelope.data

    const normalizedData = {
      videoId:         backendData.video_id,
      title:           backendData.title,
      channelName:     backendData.channel,
      durationSeconds: backendData.duration_seconds,
      thumbnailUrl:    backendData.thumbnail_url,

      availableQualities: ((backendData.available_qualities ?? []) as number[]).map(
        (q) => ({
          label:    `${q}p`,
          formatId: String(q),
        })
      ),

      availableAudioFormats: backendData.best_audio_label
        ? [{ label: backendData.best_audio_label as string, format: backendData.best_audio_label as string }]
        : [],

      estimatedSizeBytes:   null,
      estimatedTimeSeconds: null,
    }

    return NextResponse.json({ success: true, data: normalizedData, error: null })
  } catch (err) {
    console.error('[API Proxy]', {
      route: 'POST /api/analyze',
      error: err instanceof Error ? err.message : String(err),
      time: new Date().toISOString(),
    })
    const { userMessage, status } = sanitizeBackendError(err)
    return NextResponse.json(
      { success: false, data: null, error: userMessage },
      { status }
    )
  }
}
