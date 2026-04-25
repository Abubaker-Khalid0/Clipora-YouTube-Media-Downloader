-- ============================================================================
-- deduct_credits RPC Function — v2 (Race Condition Fix)
-- ============================================================================
-- CE-05 FIX: The previous version read `jobs.credits_used` and `jobs.status`
-- WITHOUT a FOR UPDATE lock, creating a TOCTOU (time-of-check to time-of-use)
-- race condition.
--
-- Race scenario (old code):
--   1. SSE tab A: SELECT credits_used → 0 (no lock held)
--   2. SSE tab B: SELECT credits_used → 0 (also passes, same unguarded read)
--   3. Tab A: SELECT profiles FOR UPDATE → acquires lock, deducts credits
--   4. Tab A: commits, releases lock
--   5. Tab B: SELECT profiles FOR UPDATE → acquires lock, deducts credits AGAIN
--   Result: user billed twice for one download.
--
-- Fix strategy:
--   Lock the JOBS row first (FOR UPDATE) before checking credits_used.
--   Any concurrent call for the same job_id will block at this point until
--   the first call either commits or rolls back, guaranteeing serialization.
--   The profiles row is then locked in a second FOR UPDATE — maintaining full
--   atomicity of the balance deduction.
--
-- Lock order is always:  jobs row → profiles row
-- This order must be respected by all callers to prevent deadlocks.
-- ============================================================================
--
-- Parameters:
--   p_user_id: UUID of the user whose credits to deduct
--   p_amount:  Number of credits to deduct (must be > 0)
--   p_job_id:  UUID of the job (for idempotency guard)
--
-- Returns:
--   -2  → Job already processed (idempotency guard) — treat as success
--   -1  → Insufficient credits
--   >=0 → New balance after successful deduction
-- ============================================================================

CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount  INTEGER,
  p_job_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
  v_job_credits     INTEGER;
  v_job_status      TEXT;
BEGIN
  -- Guard: amount must be positive
  IF p_amount <= 0 THEN
    RETURN 0;  -- No deduction needed for zero/negative amounts
  END IF;

  -- ── CE-05 FIX: Idempotency check WITH row-level lock ─────────────────────
  --
  -- FOR UPDATE on the jobs row serializes all concurrent calls for this
  -- job_id.  The second caller will block here until the first transaction
  -- commits, at which point it will see credits_used > 0 and return -2.
  --
  -- SKIP LOCKED is intentionally NOT used: we want concurrent calls to wait,
  -- not skip — skipping would mask double-billing instead of preventing it.
  SELECT credits_used, status
  INTO   v_job_credits, v_job_status
  FROM   jobs
  WHERE  id = p_job_id
  FOR UPDATE;

  IF FOUND THEN
    -- Job exists — check if credits were already deducted.
    -- After the lock above, this check is now race-free.
    IF v_job_credits IS NOT NULL AND v_job_credits > 0 THEN
      RETURN -2;  -- Idempotency: already processed
    END IF;

    IF v_job_status = 'success' THEN
      RETURN -2;  -- Job completed without credits_used record (edge case)
    END IF;
  ELSE
    -- Job row not found — cannot proceed safely.
    -- This should not happen in normal operation (job is inserted before
    -- the download starts), but return -1 as a safe fallback.
    RETURN -1;
  END IF;

  -- ── Lock the user's profile row to prevent concurrent balance deductions ──
  --
  -- Lock order: jobs row (above) → profiles row (here).
  -- Consistent lock ordering across all callers prevents deadlocks.
  SELECT credits
  INTO   v_current_balance
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  -- If user not found, return -1 (insufficient / not found)
  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  -- Check for sufficient credits
  IF v_current_balance < p_amount THEN
    RETURN -1;  -- Insufficient credits
  END IF;

  -- Deduct credits atomically
  v_new_balance := v_current_balance - p_amount;

  UPDATE profiles
  SET    credits     = v_new_balance,
         updated_at  = NOW()
  WHERE  id = p_user_id;

  -- Bookkeeping: mark the job as credits_used > 0.
  -- This is the idempotency commit point — any future call for the same
  -- job_id will see credits_used > 0 after the jobs FOR UPDATE and
  -- return -2 immediately.
  UPDATE jobs
  SET    credits_used = p_amount,
         status       = 'success',
         updated_at   = NOW()
  WHERE  id = p_job_id;

  RETURN v_new_balance;
END;
$$;

-- Grant execution permission to authenticated users only
GRANT EXECUTE ON FUNCTION deduct_credits(UUID, INTEGER, UUID) TO authenticated;
