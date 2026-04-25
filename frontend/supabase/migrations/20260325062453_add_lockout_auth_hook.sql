-- 20260325062453_add_lockout_auth_hook.sql
-- Creates a Supabase Custom Access Token Hook that blocks locked-out users
-- at the server layer, before any session token is issued (fixes L-05 / R-08).
--
-- IMPORTANT: After running this migration you MUST register the hook manually:
--
--   Supabase Cloud Dashboard:
--     1. Go to Project → Authentication → Hooks
--     2. Click "Add hook" → choose "Custom Access Token Hook"
--     3. Select the function: public.handle_custom_access_token
--     4. Save.
--
--   Local dev (supabase/config.toml):
--     [auth.hook.custom_access_token]
--     enabled = true
--     uri = "pg-functions://postgres/public/handle_custom_access_token"
--
-- NOTE ON SCHEMA: The profiles table uses `locked_until TIMESTAMPTZ`.
-- The function checks `locked_until > NOW()` consistent with migration
-- 00006_auth_security_fields.sql and the existing client-side logic.
--
-- NOTE ON FUNCTION SIGNATURE: Supabase Custom Access Token Hooks MUST accept
-- a single `event jsonb` argument and MUST return `jsonb`. A RETURNS void
-- function cannot be registered as an auth hook and will be silently ignored.
-- The hook must return the event unchanged (or with modifications) to allow
-- the sign-in to proceed.

CREATE OR REPLACE FUNCTION public.handle_custom_access_token(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id  uuid;
  lock_end timestamptz;
BEGIN
  -- Extract the user ID from the hook event payload.
  -- Supabase passes: { "user_id": "...", "claims": { ... } }
  user_id := (event->>'user_id')::uuid;

  -- Look up the lock status for this user.
  SELECT locked_until
  INTO   lock_end
  FROM   public.profiles
  WHERE  id = user_id;

  -- No profile row yet → allow sign-in (new user, first login).
  -- locked_until IS NULL → not locked, allow sign-in.
  -- locked_until <= NOW() → lockout expired, allow sign-in.
  IF lock_end IS NOT NULL AND lock_end > NOW() THEN
    -- Raising an exception here causes Supabase auth to return an error
    -- to the caller, preventing the JWT from being issued at all.
    RAISE EXCEPTION 'Account is locked. Please contact support.';
  END IF;

  -- Return the event unchanged to allow the token to be issued normally.
  RETURN event;
END;
$$;

-- Allow the internal Supabase roles used by auth hooks to call this function.
GRANT EXECUTE ON FUNCTION public.handle_custom_access_token(jsonb) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_custom_access_token(jsonb) TO service_role;

-- Revoke from public to ensure only privileged roles can invoke it.
REVOKE EXECUTE ON FUNCTION public.handle_custom_access_token(jsonb) FROM PUBLIC;
