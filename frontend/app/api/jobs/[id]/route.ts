import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { proxyFetch, sanitizeBackendError } from '@/lib/backend'

/**
 * T009 — GET /api/jobs/[id]
 * Proxies job status fetch from FastAPI backend.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireSession()
    if (authResult instanceof NextResponse) return authResult

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

    // Unwrap the backend's { success, data } envelope — do NOT re-wrap.
    // The backend returns { success: true, data: { id, status, stage, … } }.
    // Forwarding the whole object as `data` would produce a double-nested shape.
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
