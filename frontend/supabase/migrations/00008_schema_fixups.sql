-- 00008_schema_fixups.sql
-- Fixups to align the database schema with database.types.ts:
--
-- 1. jobs.video_id: make nullable (types declare `string | null` but original
--    migration had NOT NULL — jobs may be created before video info is resolved).
--
-- 2. Drop the old deduct_credits(UUID, INTEGER) overload from 00005 to avoid
--    function ambiguity now that 00007 introduced deduct_credits(UUID, INTEGER, UUID).

-- ── 1. Make jobs.video_id nullable ────────────────────────────────────────────
ALTER TABLE jobs
  ALTER COLUMN video_id DROP NOT NULL;

-- ── 2. Drop the original 2-arg overload (superseded by 3-arg idempotent version) ──
-- The 3-arg version (p_user_id, p_amount, p_job_id) in 00007 is the authoritative one.
-- Dropping the 2-arg version prevents PostgREST / supabase-js from calling the
-- wrong overload when p_job_id is omitted by mistake.
DROP FUNCTION IF EXISTS public.deduct_credits(UUID, INTEGER);
