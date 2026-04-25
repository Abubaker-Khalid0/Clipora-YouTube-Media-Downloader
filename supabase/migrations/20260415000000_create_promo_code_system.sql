-- ============================================================================
-- Promo Code System
-- Tables + atomic redemption RPC
-- ============================================================================

-- ── 1. promo_codes table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  credits     INTEGER NOT NULL CHECK (credits > 0),
  max_uses    INTEGER DEFAULT NULL,          -- NULL = unlimited
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ DEFAULT NULL,      -- NULL = never expires
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast code lookups (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code_upper ON promo_codes (UPPER(code));

-- ── 2. promo_redemptions table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  promo_code_id   UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  credits_awarded INTEGER NOT NULL,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can redeem a specific code only once
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_redemptions_user_code
  ON promo_redemptions (user_id, promo_code_id);

-- ── 3. RLS policies ─────────────────────────────────────────────────────────
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- promo_codes: no direct access from client — only via RPC
-- (no SELECT/INSERT/UPDATE/DELETE policies = deny all direct access)

-- promo_redemptions: users can read their own redemptions
CREATE POLICY "Users can view own redemptions"
  ON promo_redemptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 4. redeem_promo_code RPC ─────────────────────────────────────────────────
-- Atomic function that validates & redeems a promo code.
--
-- Parameters:
--   p_user_id : UUID  — the authenticated user
--   p_code    : TEXT  — the promo code string (case-insensitive)
--
-- Returns:
--   > 0  → credits awarded (success)
--   -1   → invalid / inactive code
--   -2   → already redeemed by this user
--   -3   → code has expired
--   -4   → max uses reached
-- ============================================================================
CREATE OR REPLACE FUNCTION redeem_promo_code(
  p_user_id UUID,
  p_code    TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo        RECORD;
  v_already_used BOOLEAN;
BEGIN
  -- 1. Find the promo code (case-insensitive) and lock the row
  SELECT id, credits, max_uses, current_uses, is_active, expires_at
  INTO   v_promo
  FROM   promo_codes
  WHERE  UPPER(code) = UPPER(p_code)
  FOR UPDATE;

  -- Code not found or inactive
  IF NOT FOUND OR NOT v_promo.is_active THEN
    RETURN -1;
  END IF;

  -- 2. Check expiration
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < NOW() THEN
    RETURN -3;
  END IF;

  -- 3. Check max uses
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN -4;
  END IF;

  -- 4. Check if user already redeemed this code
  SELECT EXISTS(
    SELECT 1
    FROM   promo_redemptions
    WHERE  user_id = p_user_id
      AND  promo_code_id = v_promo.id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN -2;
  END IF;

  -- 5. All checks passed — execute redemption atomically

  -- Increment usage counter
  UPDATE promo_codes
  SET    current_uses = current_uses + 1
  WHERE  id = v_promo.id;

  -- Record the redemption
  INSERT INTO promo_redemptions (user_id, promo_code_id, credits_awarded)
  VALUES (p_user_id, v_promo.id, v_promo.credits);

  -- Add credits to user's balance
  UPDATE profiles
  SET    credits = credits + v_promo.credits,
         updated_at = NOW()
  WHERE  id = p_user_id;

  -- Return credits awarded
  RETURN v_promo.credits;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION redeem_promo_code(UUID, TEXT) TO authenticated;
