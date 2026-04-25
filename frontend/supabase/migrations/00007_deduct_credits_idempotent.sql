-- 00007_deduct_credits_idempotent.sql
--
-- Replaces the original deduct_credits function with an idempotent version
-- that accepts p_job_id and prevents double-billing on concurrent SSE reconnects.
--
-- Idempotency contract:
--   If the job row already has status = 'success', the deduction has already
--   been applied — return the current balance without deducting again.
--
-- Error contract:
--   Returns -1 if the user has insufficient credits (balance < p_amount).
--   Returns -2 if the job has already been credited (idempotency guard).
--   Returns the new balance (>= 0) on success.
--
-- Called ONLY on SSE stage='complete' event — never at job creation.
-- (Constitution Principle V)

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount  INTEGER,
  p_job_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_credits INTEGER;
  v_job_status      TEXT;
  v_new_balance     INTEGER;
BEGIN
  -- ── Idempotency guard ────────────────────────────────────────────────────
  -- If this job was already marked success, the credits were already deducted.
  -- Return -2 to signal "already processed" without deducting again.
  SELECT status INTO v_job_status
  FROM jobs
  WHERE id = p_job_id;

  IF v_job_status = 'success' THEN
    SELECT credits INTO v_current_credits FROM profiles WHERE id = p_user_id;
    RETURN -2; -- sentinel: already credited
  END IF;

  -- ── Atomic balance check + deduction ─────────────────────────────────────
  -- Lock the profile row to prevent concurrent deductions from racing.
  SELECT credits INTO v_current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN -1; -- user profile not found → treat as insufficient
  END IF;

  IF v_current_credits < p_amount THEN
    RETURN -1; -- insufficient credits — do not deduct
  END IF;

  v_new_balance := v_current_credits - p_amount;

  UPDATE profiles
  SET    credits    = v_new_balance,
         updated_at = NOW()
  WHERE  id = p_user_id;

  RETURN v_new_balance;
END;
$$;

-- Grant execute to authenticated users (the function is SECURITY DEFINER,
-- so it runs as the function owner but can be called by authenticated role).
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, UUID)
  TO authenticated;
