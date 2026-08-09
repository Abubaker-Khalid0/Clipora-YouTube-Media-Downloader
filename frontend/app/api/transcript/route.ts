import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch, sanitizeBackendError } from '@/lib/backend'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimiter'

/**
 * POST /api/transcript
 *
 * Proxies YouTube transcript fetching to the FastAPI backend.
 * No auth or credits during development.
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, RATE_LIMITS.ANALYZE)
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.retryAfter)
  }

  // `isLanguageSwitch` used to ride along on this request so a language change
  // would not be charged credits. It was never read here, and there are no
  // credits, so it is gone from the contract.
  let body: { videoId?: string; lang?: string }
  try {
    body = (await request.json()) as { videoId?: string; lang?: string }
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  if (!body.videoId) {
    return NextResponse.json(
      { success: false, data: null, error: 'Video ID is required' },
      { status: 400 }
    )
  }

  try {
    const backendRes = await proxyFetch('/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: body.videoId,
        lang: body.lang ?? 'en',
      }),
    })

    const envelope = (await backendRes.json()) as {
      success: boolean
      data: Record<string, unknown>
      error?: string
    }

    if (!envelope.success) {
      return NextResponse.json(
        { success: false, data: null, error: envelope.error ?? 'Failed to fetch transcript' },
        { status: 502 }
      )
    }

    const backendData = envelope.data as {
      snippets: Array<{ text: string; start: number; duration: number }>
      available_languages: Array<{ code: string; name: string; is_generated: boolean }>
      language: string
      language_code: string
      is_generated: boolean
      video_id: string
    }

    const normalizedData = {
      snippets: backendData.snippets,
      availableLanguages: backendData.available_languages.map((l) => ({
        code: l.code,
        name: l.name,
        isGenerated: l.is_generated,
      })),
      language: backendData.language,
      languageCode: backendData.language_code,
      isGenerated: backendData.is_generated,
      videoId: backendData.video_id,
    }

    return NextResponse.json({ success: true, data: normalizedData, error: null })
  } catch (err) {
    console.error('[API Proxy]', {
      route: 'POST /api/transcript',
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
