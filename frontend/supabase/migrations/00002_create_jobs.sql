-- 00002_create_jobs.sql
-- Creates the jobs table for tracking media processing tasks
-- Depends on: 00001_create_profiles.sql (profiles table must exist)

CREATE TABLE IF NOT EXISTS jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Video metadata
  video_id       TEXT        NOT NULL,
  video_title    TEXT,
  thumbnail_url  TEXT,

  -- Processing options
  mode           TEXT        NOT NULL CHECK (mode IN ('video', 'audio', 'thumbnail')),
  quality        TEXT,
  format         TEXT,
  file_size      BIGINT,

  -- Job state
  status         TEXT        NOT NULL DEFAULT 'processing'
                             CHECK (status IN ('processing', 'success', 'failed')),
  credits_used   INTEGER     NOT NULL DEFAULT 0,

  -- Trim fields (Constitution Principle VII — mandatory)
  trim_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  trim_start     TEXT,
  trim_end       TEXT,

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jobs_user_id  ON jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status   ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created  ON jobs (created_at DESC);
