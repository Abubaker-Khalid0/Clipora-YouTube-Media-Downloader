import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { proxyFetch } from '@/lib/backend'

/**
 * T010 — GET /api/files/download/[id]
 *
 * Serves the completed output file to the job owner only.
 * Non-owners receive 404 (not 403) to avoid confirming job existence.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSession()
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { id } = await params

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, user_id, status')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { success: false, data: null, error: 'File not found or expired' },
      { status: 404 }
    )
  }

  // Return 404 instead of 403 — avoids leaking that the job exists
  // to a caller who does not own it. Matches the backend's behaviour.
  if (job.user_id !== user.id) {
    return NextResponse.json(
      { success: false, data: null, error: 'File not found or expired' },
      { status: 404 }
    )
  }

  if (job.status !== 'success') {
    return NextResponse.json(
      { success: false, data: null, error: 'File not ready or expired' },
      { status: 404 }
    )
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await proxyFetch(`/api/files/download/${id}`, {
      headers: { 'X-User-Id': user.id },
    })
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'File unavailable' },
      { status: 502 }
    )
  }

  const contentDisposition =
    upstreamResponse.headers.get('Content-Disposition') ??
    `attachment; filename="download-${id}"`

  const contentType =
    upstreamResponse.headers.get('Content-Type') ?? 'application/octet-stream'

  const responseHeaders: HeadersInit = {
    'Content-Type': contentType,
    'Content-Disposition': contentDisposition,
  }

  const contentLength = upstreamResponse.headers.get('Content-Length')
  if (contentLength) {
    responseHeaders['Content-Length'] = contentLength
  }

  return new Response(upstreamResponse.body, { headers: responseHeaders })
}