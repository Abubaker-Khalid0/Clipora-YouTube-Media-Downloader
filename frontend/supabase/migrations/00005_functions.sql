-- 00005_functions.sql
-- deduct_credits: atomically deducts credits from a profile.
-- Returns TRUE on success, FALSE when the user has insufficient credits.
-- Called ONLY on SSE 'complete' event — never at job creation (Constitution Principle V).

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount  INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Atomically deduct credits only if the user has enough
  UPDATE profiles
  SET credits = credits - p_amount
  WHERE id = p_user_id
    AND credits >= p_amount;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Returns TRUE if deduction succeeded, FALSE if insufficient credits
  RETURN v_updated > 0;
END;
$$;

