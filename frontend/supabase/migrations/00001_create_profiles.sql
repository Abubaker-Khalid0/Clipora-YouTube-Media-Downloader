-- 00001_create_profiles.sql
-- Creates the core profiles table extending auth.users

CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT,
  avatar_url     TEXT,
  credits        INTEGER NOT NULL DEFAULT 10 CHECK (credits >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for primary key (already created by PK, this is explicit)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey_idx ON profiles(id);
