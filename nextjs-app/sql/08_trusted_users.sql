-- ========================================
-- MEMBERSHIP WHITELIST & ONBOARDING RPC
-- Replaces legacy trusted_users implementation
-- ========================================

-- Clean up legacy objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.trusted_users;

-- Ensure updated_at stays in sync on memberships
CREATE OR REPLACE FUNCTION public.set_memberships_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_memberships_updated_at ON public.memberships;
CREATE TRIGGER set_memberships_updated_at
BEFORE UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.set_memberships_updated_at();

-- RPC: ensure_membership_from_whitelist
CREATE OR REPLACE FUNCTION public.ensure_membership_from_whitelist()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text;
  whitelist_record public.membership_whitelist%ROWTYPE;
  membership_record public.memberships%ROWTYPE;
  expires_at date;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO current_email
  FROM auth.users
  WHERE id = current_user_id;

  IF current_email IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO membership_record
  FROM public.memberships
  WHERE user_id = current_user_id;

  IF FOUND THEN
    IF membership_record.email IS DISTINCT FROM current_email THEN
      UPDATE public.memberships
      SET email = current_email
      WHERE user_id = current_user_id;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO whitelist_record
  FROM public.membership_whitelist
  WHERE lower(email) = lower(current_email)
    AND active IS TRUE
    AND consumed_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  expires_at := (CURRENT_DATE + INTERVAL '1 year')::date;

  INSERT INTO public.memberships (
    user_id,
    email,
    first_name,
    last_name,
    full_name,
    phone,
    branch_id,
    role,
    membership_active,
    membership_expires,
    approved,
    approved_at
  )
  VALUES (
    current_user_id,
    current_email,
    whitelist_record.first_name,
    whitelist_record.last_name,
    NULLIF(concat_ws(' ', whitelist_record.first_name, whitelist_record.last_name), ''),
    whitelist_record.phone,
    whitelist_record.branch_id,
    whitelist_record.role,
    true,
    expires_at,
    true,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.membership_whitelist
  SET
    consumed_at = now(),
    consumed_by = current_user_id,
    active = false
  WHERE id = whitelist_record.id;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'ensure_membership_from_whitelist failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_membership_from_whitelist() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_membership()
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_membership_from_whitelist();
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_membership() TO authenticated, service_role;

-- Provide visibility into whitelist usage for admins/council/technicians
CREATE OR REPLACE VIEW public.membership_whitelist_status AS
SELECT
  id,
  email,
  first_name,
  last_name,
  role,
  branch_id,
  note,
  invited_at,
  invited_by,
  consumed_at,
  consumed_by,
  active
FROM public.membership_whitelist;
