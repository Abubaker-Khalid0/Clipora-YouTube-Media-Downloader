-- ============================================================================
-- deduct_credits RPC Function
-- Atomic credit deduction with idempotency guard
-- ============================================================================
-- Called from: frontend/lib/credits.ts:deductCredits()
-- Parameters:
--   p_user_id: UUID of the user whose credits to deduct
--   p_amount:  Number of credits to deduct (must be > 0)
--   p_job_id:  UUID of the job (for idempotency guard)
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

  -- Idempotency check: has this job already been processed?
  -- If the job exists and has credits_used set OR status is 'success',
  -- return -2 to signal "already processed".
  SELECT credits_used, status
  INTO   v_job_credits, v_job_status
  FROM   jobs
  WHERE  id = p_job_id;

  IF FOUND THEN
    -- Job exists — check if credits were already deducted
    IF v_job_credits IS NOT NULL AND v_job_credits > 0 THEN
      RETURN -2;  -- Idempotency: already processed
    END IF;
    
    IF v_job_status = 'success' THEN
      RETURN -2;  -- Job completed without credits_used record (edge case)
    END IF;
  END IF;

  -- Lock the user's profile row to prevent concurrent deductions
  -- FOR UPDATE ensures atomicity across concurrent requests
  SELECT credits
  INTO   v_current_balance
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  -- If user not found, return -1 (insufficient)
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
  SET    credits = v_new_balance,
         updated_at = NOW()
  WHERE  id = p_user_id;

  -- Bookkeeping: update the job record with credits_used
  -- This is the commit point for idempotency — any future call for same job_id
  -- will see credits_used > 0 and return -2 immediately
  UPDATE jobs
  SET    credits_used = p_amount,
         updated_at = NOW()
  WHERE  id = p_job_id;

  RETURN v_new_balance;
END;
$$;

-- Grant execution permission to authenticated users (Supabase anon role)
GRANT EXECUTE ON FUNCTION deduct_credits(UUID, INTEGER, UUID) TO authenticated;