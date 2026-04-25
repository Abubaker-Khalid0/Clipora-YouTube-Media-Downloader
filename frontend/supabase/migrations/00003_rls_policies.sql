-- 00003_rls_policies.sql
-- Row Level Security policies for the profiles and jobs tables

-- ── Profiles ──────────────────────────────────────────────────────────────────

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: INSERT is handled via trigger with service_role only.
-- No user-facing INSERT policy is defined.

-- ── Jobs ──────────────────────────────────────────────────────────────────────

-- Enable RLS on jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Policy: users can view their own jobs
CREATE POLICY "Users can view own jobs"
  ON jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: users can create their own jobs
CREATE POLICY "Users can insert own jobs"
  ON jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can delete their own jobs
CREATE POLICY "Users can delete own jobs"
  ON jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: UPDATE is reserved for the Python backend via service_role (bypasses RLS).
-- No user-facing UPDATE policy is defined on jobs.

