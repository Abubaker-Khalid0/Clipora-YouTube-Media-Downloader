import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

/**
 * GET /api/jobs/[id]/stream
 *
 * Proxies the SSE stream from the FastAPI backend to the browser.
 * No auth, no credit deduction, no DB updates during development.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Open upstream SSE connection (no timeout)
  const upstreamUrl = `${env.backendUrl}/api/jobs/${id}/stream`
  let upstreamResponse: Response

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'text/event-stream',
        'X-Internal-Api-Key': env.internalApiKey,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to connect to job stream' },
      { status: 502 }
    )
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return NextResponse.json(
      { success: false, data: null, error: 'Job stream unavailable' },
      { status: 502 }
    )
  }

  // Pass through directly — no transform needed without credits/DB
  return new Response(upstreamResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
