-- =============================================================================
-- PSYCHOČAS — AUTH USER WHITELIST GUARD
-- =============================================================================
-- Ensures new auth.users rows can be created only for emails that are present
-- and active in public.member_whitelist.
-- This protects the OTP flow from direct API calls that bypass frontend checks.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_auth_user_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.member_whitelist w
    WHERE lower(w.email) = lower(new.email)
      AND w.is_active = true
  ) THEN
    RAISE EXCEPTION 'Email is not whitelisted'
      USING HINT = 'not_whitelisted';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_whitelist_guard ON auth.users;

CREATE TRIGGER on_auth_user_whitelist_guard
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_auth_user_whitelist();
