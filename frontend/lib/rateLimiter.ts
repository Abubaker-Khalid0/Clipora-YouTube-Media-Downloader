/**
 * In-memory rate limiter for Next.js API routes.
 * Uses a sliding window algorithm with per-IP tracking.
 * 
 * NOTE: This is a simple in-memory implementation suitable for single-instance deployments.
 * For multi-instance/serverless deployments, consider using @upstash/ratelimit with Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Map of IP -> { endpoint -> entry }
const rateLimitStore = new Map<string, Map<string, RateLimitEntry>>()

// Cleanup interval: remove entries older than 2x their window
const CLEANUP_INTERVAL_MS = 60_000 // 1 minute

// Run periodic cleanup to prevent memory leaks
let cleanupInterval: NodeJS.Timeout | null = null

function startCleanup(): void {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [ip, endpointMap] of rateLimitStore.entries()) {
      for (const [endpoint, entry] of endpointMap.entries()) {
        if (now > entry.resetAt + 60_000) {
          endpointMap.delete(endpoint)
        }
      }
      if (endpointMap.size === 0) {
        rateLimitStore.delete(ip)
      }
    }
  }, CLEANUP_INTERVAL_MS)
}

// Start cleanup on module load
if (typeof window === 'undefined') {
  startCleanup()
}

/**
 * Get client IP from request headers.
 * Handles X-Forwarded-For, X-Real-IP, and falls back to a default.
 */
function getClientIp(request: Request): string {
  // Vercel/edge environments: check standard headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For: client, proxy1, proxy2 - first is the client
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  // Local development fallback
  return '127.0.0.1'
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Unique identifier for this rate limit rule (e.g., 'analyze', 'job-create') */
  key: string
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  retryAfter: number
}

/**
 * Check rate limit for a request.
 * Returns { success: true } if allowed, { success: false } if limit exceeded.
 * 
 * @param request - The incoming request
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining requests and reset time
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): RateLimitResult {
  const ip = getClientIp(request)
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  // Get or create IP entry
  let ipEntry = rateLimitStore.get(ip)
  if (!ipEntry) {
    ipEntry = new Map()
    rateLimitStore.set(ip, ipEntry)
  }

  // Get or create endpoint entry
  let entry = ipEntry.get(config.key)
  if (!entry || now > entry.resetAt) {
    // Window expired or new entry - reset counter
    entry = {
      count: 0,
      resetAt: now + windowMs,
    }
    ipEntry.set(config.key, entry)
  }

  // Increment and check
  entry.count++
  const remaining = Math.max(0, config.limit - entry.count)
  const success = entry.count <= config.limit
  const retryAfter = success ? 0 : Math.ceil((entry.resetAt - now) / 1000)

  return {
    success,
    remaining: success ? remaining : 0,
    resetAt: entry.resetAt,
    retryAfter,
  }
}

/**
 * Create a rate limit response (HTTP 429).
 * Follows the same error format as other API routes.
 */
export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: 'Too many requests. Please wait before trying again.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  )
}

// Pre-configured rate limiters matching FastAPI limits
export const RATE_LIMITS = {
  /** Analyze endpoint: 10 requests per minute */
  ANALYZE: { limit: 10, windowSeconds: 60, key: 'analyze' } satisfies RateLimitConfig,
  /** Job creation endpoint: 5 requests per minute */
  JOB_CREATE: { limit: 5, windowSeconds: 60, key: 'job-create' } satisfies RateLimitConfig,
  /** Promo code redemption: 3 attempts per minute (anti brute-force) */
  PROMO_REDEEM: { limit: 3, windowSeconds: 60, key: 'promo-redeem' } satisfies RateLimitConfig,
} as const