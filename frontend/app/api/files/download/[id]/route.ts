import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/backend'

/**
 * GET /api/files/download/[id]
 *
 * Proxies the file download from the backend.
 * No auth or ownership checks during development.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let upstreamResponse: Response
  try {
    upstreamResponse = await proxyFetch(`/api/files/download/${id}`, {
      headers: { 'X-User-Id': '00000000-0000-0000-0000-000000000001' },
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
