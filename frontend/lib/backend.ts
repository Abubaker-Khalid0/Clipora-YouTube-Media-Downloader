import { env } from './env'

/**
 * Typed error thrown when the FastAPI backend returns a non-2xx response.
 */
export class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

/**
 * Shape of every error response from the refactored FastAPI backend.
 *
 * Clipora app errors:      { success: false, error: string }
 * FastAPI 422 validation:  { detail: Array<{ loc, msg, type }> }
 * FastAPI other errors:    { detail: string }
 */
interface BackendErrorBody {
  error?: string
  detail?: string | Array<{ msg?: string; loc?: unknown[]; type?: string }>
  message?: string
}

/**
 * Extract a human-readable string from FastAPI's detail field.
 * detail can be a plain string OR an array of Pydantic validation objects.
 */
function extractDetail(detail: BackendErrorBody['detail']): string | undefined {
  if (!detail) return undefined
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    // Collect all validation messages — e.g. "url: Field required"
    return detail
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc.filter((l) => l !== 'body').join('.') : ''
        const msg = e.msg ?? 'Validation error'
        return field ? `${field}: ${msg}` : msg
      })
      .join(', ')
  }
  return undefined
}

/**
 * T005 — Proxy fetch helper for Next.js API routes.
 *
 * Prepends BACKEND_URL to `path`, attaches the internal auth header,
 * and throws a BackendError on non-2xx responses.
 *
 * @param path      Relative backend path, e.g. '/api/analyze'
 * @param init      Standard RequestInit (method, headers, body, …)
 * @param timeoutMs Abort after this many ms. Pass 0 to disable (SSE streams).
 */
export async function proxyFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs: number = 30_000
): Promise<Response> {
  const url = `${env.backendUrl}${path}`
  const signal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined

  const headers = new Headers((init.headers as HeadersInit | undefined) ?? {})
  headers.set('X-Internal-Api-Key', env.internalApiKey)

  const res = await fetch(url, { ...init, headers, signal })

  if (!res.ok) {
    let message = `Backend error ${res.status}`
    try {
      const body = (await res.json()) as BackendErrorBody
      // Priority: app-level error → FastAPI detail (string or array) → legacy message → generic
      message = body.error ?? extractDetail(body.detail) ?? body.message ?? message
    } catch {
      // Body is not JSON — keep the generic message
    }
    throw new BackendError(res.status, message)
  }

  return res
}

/**
 * Converts a BackendError (or any Error) to a sanitised user-facing message.
 * Never exposes BACKEND_URL, stack traces, or internal identifiers.
 */
export function sanitizeBackendError(err: unknown): {
  userMessage: string
  status: number
} {
  if (err instanceof BackendError) {
    if (err.status === 409) return { userMessage: 'A download is already in progress', status: 409 }
    if (err.status === 404) return { userMessage: 'Resource not found', status: 404 }
    if (err.status === 422) return { userMessage: err.message, status: 422 }
    if (err.status >= 500) return { userMessage: 'The download service is temporarily unavailable', status: 502 }
    return { userMessage: err.message, status: err.status }
  }

  if (err instanceof Error && err.name === 'TimeoutError') {
    return { userMessage: 'The request timed out. Please try again.', status: 504 }
  }

  return { userMessage: 'An unexpected error occurred', status: 500 }
}