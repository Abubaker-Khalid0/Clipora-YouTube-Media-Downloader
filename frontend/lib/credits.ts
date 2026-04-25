import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { normalizeQuality } from './utils'

type AppSupabaseClient = SupabaseClient<Database>

/**
 * Returns the number of credits required for a download job.
 *
 * Quality param must be WITHOUT 'p' suffix — use normalizeQuality() before calling.
 * (This function also applies normalizeQuality() internally as a defensive guard.)
 *
 * Constitution rules:
 *   - Standard video (≤1080p) → 1 credit
 *   - 4K video (1440p / 2160p) → 2 credits
 *   - Audio extraction → 1 credit
 *   - Trim modifier → +1 credit on top of base cost
 *   - Thumbnail download → 0 credits
 */
export function getCreditCost(
  mode: 'video' | 'audio' | 'thumbnail',
  quality: string,
  trimEnabled: boolean
): number {
  if (mode === 'thumbnail') return 0

  let base: number

  if (mode === 'audio') {
    base = 1
  } else {
    // mode === 'video' — normalise defensively so "1440p" and "1440" are identical
    const nq = normalizeQuality(quality)
    const is4K = nq === '1440' || nq === '2160'
    base = is4K ? 2 : 1
  }

  return trimEnabled ? base + 1 : base
}

// ─── Credit helpers ───────────────────────────────────────────────────────────

/**
 * Checks whether the user has at least `required` credits.
 * Reads from the `profiles` table.
 */
export async function checkCredits(
  supabase: AppSupabaseClient,
  userId: string,
  required: number
): Promise<{ sufficient: boolean; balance: number }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()

  if (error || data === null) {
    return { sufficient: false, balance: 0 }
  }

  const balance = data.credits ?? 0
  // required === 0 means free (e.g. thumbnail) — always sufficient
  return { sufficient: required === 0 || balance >= required, balance }
}

/**
 * Deducts `amount` credits from the user's balance via the `deduct_credits` RPC.
 *
 * Idempotency is handled at the database level by the RPC function itself —
 * no client-side pre-check is used here because:
 *   1. The pre-check reads job.status BEFORE it is set to 'success'
 *      (status is updated AFTER this function returns), so it never fires.
 *   2. Two concurrent calls can both pass the pre-check before either writes,
 *      resulting in double billing.
 *
 * The RPC is the single atomic gatekeeper.
 *
 * RPC return value contract:
 *   -2 → already credited for this job (idempotency guard fired) — treat as success
 *   -1 → insufficient credits
 *   ≥0 → new balance after deduction (success)
 */
export async function deductCredits(
  supabase: AppSupabaseClient,
  userId: string,
  amount: number,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  // Thumbnail jobs cost 0 — nothing to deduct
  if (amount === 0) return { success: true }

  // Credits deducted before status update — order is intentional for idempotency.
  // The RPC is the single source of truth; relying on it rather than a racy
  // client-side status read prevents double-billing on concurrent reconnects.
  const { data: newBalance, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_job_id: jobId,
  })

  if (error) {
    console.error(`[credits] deductCredits RPC error for job ${jobId}:`, error.message)
    return { success: false, error: error.message }
  }

  // -2: idempotency guard — job was already credited, no action needed
  if (newBalance === -2) {
    return { success: true }
  }

  // -1: insufficient credits
  if (newBalance === -1) {
    const msg = 'Insufficient credits to complete this download.'
    console.error(`[credits] deductCredits failed for job ${jobId}: ${msg}`)
    return { success: false, error: msg }
  }

  return { success: true }
}
