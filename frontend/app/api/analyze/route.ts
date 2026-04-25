import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { proxyFetch, sanitizeBackendError } from '@/lib/backend'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimiter'

/**
 * T006 [US1] — POST /api/analyze
 *
 * Proxies YouTube URL analysis to the FastAPI backend.
 * Requires a valid Supabase session cookie — unauthenticated requests return 401.
 *
 * Flow:
 *  1. Verify session via requireSession
 *  2. Check rate limit (10/minute per IP)
 *  3. Parse and validate request body (url field)
 *  4. Forward to backend via proxyFetch with 30s timeout
 *  5. Unwrap the backend envelope { success, data } — do NOT re-wrap it
 *  6. Return { success, data: backendData, error } to the client
 *  7. Sanitize any 5xx errors to generic user-facing messages
 *
 * IMPORTANT — double-wrap prevention:
 *   The backend already returns { success: true, data: { video_id, ... } }.
 *   We must call `envelope.data` and forward THAT, not forward the whole
 *   envelope as `data` again (which would produce { data: { success, data: ... } }).
 */
export async function POST(request: NextRequest) {
  const sessionResult = await requireSession()

  if (sessionResult instanceof NextResponse) {
    return sessionResult
  }

  // Rate limit: 10 requests per minute per IP (matches FastAPI backend)
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
    })

    // Unwrap the backend's { success, data } envelope.
    // `backendData` is the AnalyzeData payload: { video_id, title, ... }
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

    // Forward backendData directly — one clean level, no double-wrapping.
    const backendData = envelope.data

    // BUG-02 — Normalize snake_case backend fields → camelCase VideoMetadata shape.
    // The backend sends plain integers for qualities and a single string for audio;
    // the frontend interface expects object arrays.  This proxy route is the ONLY
    // normalization layer — backend schemas and frontend interfaces are NOT changed.
    const normalizedData = {
      videoId:         backendData.video_id,
      title:           backendData.title,
      channelName:     backendData.channel,
      durationSeconds: backendData.duration_seconds,
      thumbnailUrl:    backendData.thumbnail_url,

      // Transform plain int array → Array<{ label: "1080p"; formatId: "1080" }>
      availableQualities: ((backendData.available_qualities ?? []) as number[]).map(
        (q) => ({
          label:    `${q}p`,
          formatId: String(q),
        })
      ),

      // Transform single string → Array<{ label: string; format: string }>
      availableAudioFormats: backendData.best_audio_label
        ? [{ label: backendData.best_audio_label as string, format: backendData.best_audio_label as string }]
        : [],

      // Backend does not compute these — default to null so the interface is satisfied
      estimatedSizeBytes:   null,
      estimatedTimeSeconds: null,
    }

    return NextResponse.json({ success: true, data: normalizedData, error: null })
  } catch (err) {
    console.error('[API Proxy]', {
      route: 'POST /api/analyze',
      backendPath: '/api/analyze',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      time: new Date().toISOString(),
    })
    const { userMessage, status } = sanitizeBackendError(err)
    return NextResponse.json(
      { success: false, data: null, error: userMessage },
      { status }
    )
  }
}
