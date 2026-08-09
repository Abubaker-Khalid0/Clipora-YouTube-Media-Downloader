import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch, sanitizeBackendError } from '@/lib/backend'

/**
 * GET /api/jobs/[id]
 * Proxies job status fetch from FastAPI backend. No auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    let response: Response
    try {
      response = await proxyFetch(`/api/jobs/${id}`, { method: 'GET' })
    } catch (err) {
      const { userMessage, status } = sanitizeBackendError(err)
      return NextResponse.json(
        { success: false, data: null, error: userMessage },
        { status }
      )
    }

    const envelope = (await response.json()) as {
      success: boolean
      data: Record<string, unknown>
      error?: string
    }

    if (!envelope.success) {
      return NextResponse.json(
        { success: false, data: null, error: envelope.error ?? 'Failed to fetch job' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { success: true, data: envelope.data, error: null },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch job' },
      { status: 503 }
    )
  }
}
