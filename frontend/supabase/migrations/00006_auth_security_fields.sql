-- 00006_auth_security_fields.sql
-- Adds security-related columns to support:
--   FR-019: Brute-force login lockout (locked_until, failed_login_count)
--   FR-020: Password reset rate-limiting (reset_request_count, reset_window_start)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reset_request_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reset_window_start    TIMESTAMPTZ;

-- Index for efficient lockout lookups
CREATE INDEX IF NOT EXISTS idx_profiles_locked_until
  ON profiles(locked_until)
  WHERE locked_until IS NOT NULL;
