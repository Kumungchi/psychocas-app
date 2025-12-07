-- ========================================
-- PHONE NUMBER AUTHENTICATION MIGRATION
-- ========================================
-- This script updates the schema to support phone-based authentication
-- where OTP codes are sent via email to no-reply@psychocas.cz

-- Step 1: Add phone column to membership_whitelist (if not exists)
ALTER TABLE public.membership_whitelist
ADD COLUMN IF NOT EXISTS phone text UNIQUE;

-- Step 2: Make email optional in membership_whitelist (phone becomes primary)
ALTER TABLE public.membership_whitelist
ALTER COLUMN email DROP NOT NULL;

-- Step 3: Add constraint to ensure either email or phone is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_whitelist_email_or_phone_check'
  ) THEN
    ALTER TABLE public.membership_whitelist
    ADD CONSTRAINT membership_whitelist_email_or_phone_check
    CHECK (email IS NOT NULL OR phone IS NOT NULL);
  END IF;
END $$;

-- Step 4: Update memberships table to make phone unique
ALTER TABLE public.memberships
ADD CONSTRAINT IF NOT EXISTS memberships_phone_unique UNIQUE(phone);

-- Step 5: Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_membership_whitelist_phone
ON public.membership_whitelist(phone);

CREATE INDEX IF NOT EXISTS idx_memberships_phone
ON public.memberships(phone);

-- Step 6: Update ensure_membership_from_whitelist to support phone-based auth
CREATE OR REPLACE FUNCTION public.ensure_membership_from_whitelist()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_phone text;
  current_email text;
  whitelist_record public.membership_whitelist%ROWTYPE;
  membership_record public.memberships%ROWTYPE;
  expires_at date;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get user's phone number and email from auth.users
  SELECT phone, email INTO current_phone, current_email
  FROM auth.users
  WHERE id = current_user_id;

  -- Check if membership already exists
  SELECT * INTO membership_record
  FROM public.memberships
  WHERE user_id = current_user_id;

  IF FOUND THEN
    -- Update phone or email if changed
    IF membership_record.phone IS DISTINCT FROM current_phone
       OR membership_record.email IS DISTINCT FROM current_email THEN
      UPDATE public.memberships
      SET phone = COALESCE(current_phone, phone),
          email = COALESCE(current_email, email)
      WHERE user_id = current_user_id;
    END IF;
    RETURN;
  END IF;

  -- Try to find whitelist record by phone first (preferred), then by email
  IF current_phone IS NOT NULL THEN
    SELECT * INTO whitelist_record
    FROM public.membership_whitelist
    WHERE phone = current_phone
      AND active IS TRUE
      AND consumed_at IS NULL
    LIMIT 1;
  END IF;

  -- Fallback to email if phone didn't match
  IF NOT FOUND AND current_email IS NOT NULL THEN
    SELECT * INTO whitelist_record
    FROM public.membership_whitelist
    WHERE lower(email) = lower(current_email)
      AND active IS TRUE
      AND consumed_at IS NULL
    LIMIT 1;
  END IF;

  -- If no whitelist record found, user is not authorized
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Set membership expiration to 1 year from now
  expires_at := (CURRENT_DATE + INTERVAL '1 year')::date;

  -- Create membership from whitelist
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
    COALESCE(current_email, whitelist_record.email),
    whitelist_record.first_name,
    whitelist_record.last_name,
    NULLIF(concat_ws(' ', whitelist_record.first_name, whitelist_record.last_name), ''),
    COALESCE(current_phone, whitelist_record.phone),
    whitelist_record.branch_id,
    whitelist_record.role,
    true,
    expires_at,
    true,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Mark whitelist entry as consumed
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

-- Step 7: Update membership_whitelist_status view to include phone
CREATE OR REPLACE VIEW public.membership_whitelist_status AS
SELECT
  id,
  email,
  phone,
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

COMMENT ON TABLE public.membership_whitelist IS
'Whitelist of trusted users who can register. Uses phone number as primary identifier for authentication, with email as fallback.';

COMMENT ON COLUMN public.membership_whitelist.phone IS
'Phone number in E.164 format (e.g., +420123456789) - primary auth identifier';

COMMENT ON COLUMN public.membership_whitelist.email IS
'Email address - optional, used as fallback identifier and for notifications';
