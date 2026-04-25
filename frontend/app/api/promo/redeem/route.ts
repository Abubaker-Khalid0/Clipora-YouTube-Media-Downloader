import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// POST /api/promo/redeem
//
// Flow:
//   1. Auth + rate limit
//   2. Validate input
//   3. Call redeem_promo_code RPC
//   4. Return result with appropriate error messages
//
// RPC return values:
//   > 0  → credits awarded (success)
//   -1   → invalid or inactive code
//   -2   → already redeemed by this user
//   -3   → code has expired
//   -4   → max uses reached
// ---------------------------------------------------------------------------

interface RedeemBody {
  code: string
}

// Map RPC error codes to i18n-friendly error keys
const ERROR_MAP: Record<number, { key: string; status: number }> = {
  [-1]: { key: 'invalidCode', status: 404 },
  [-2]: { key: 'alreadyUsed', status: 409 },
  [-3]: { key: 'expired', status: 410 },
  [-4]: { key: 'maxUsesReached', status: 410 },
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const authResult = await requireSession()
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const rateLimit = checkRateLimit(request, RATE_LIMITS.PROMO_REDEEM)
  if (!rateLimit.success) return rateLimitResponse(rateLimit.retryAfter)

  // ── 2. Validate input ──────────────────────────────────────────────────────
  let body: RedeemBody
  try {
    body = (await request.json()) as RedeemBody
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const code = body.code?.trim()
  if (!code || typeof code !== 'string' || code.length < 2 || code.length > 50) {
    return NextResponse.json(
      { success: false, data: null, error: 'invalidCode' },
      { status: 400 }
    )
  }

  // ── 3. Call RPC ────────────────────────────────────────────────────────────
  const { data: result, error: rpcError } = await supabase.rpc('redeem_promo_code', {
    p_user_id: user.id,
    p_code: code,
  })

  if (rpcError) {
    console.error('[API] POST /api/promo/redeem RPC error:', {
      userId: user.id,
      code,
      error: rpcError.message,
      time: new Date().toISOString(),
    })
    return NextResponse.json(
      { success: false, data: null, error: 'serverError' },
      { status: 500 }
    )
  }

  // ── 4. Handle result ──────────────────────────────────────────────────────
  const creditsAwarded = result as number

  if (creditsAwarded < 0) {
    const errorInfo = ERROR_MAP[creditsAwarded] ?? { key: 'serverError', status: 500 }
    return NextResponse.json(
      { success: false, data: null, error: errorInfo.key },
      { status: errorInfo.status }
    )
  }

  return NextResponse.json(
    { success: true, data: { creditsAwarded }, error: null },
    { status: 200 }
  )
}
