-- BACKFILL MEMBERSHIPS FROM WHITELIST
-- Run this after deploying the new ensure_membership_from_whitelist RPC to migrate
-- existing auth users from legacy members/trusted_users tables.

-- Ensure legacy trigger is removed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Copy any existing whitelist entries into active memberships
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
SELECT
  u.id,
  u.email,
  w.first_name,
  w.last_name,
  NULLIF(concat_ws(' ', w.first_name, w.last_name), ''),
  w.phone,
  w.branch_id,
  w.role,
  true,
  (CURRENT_DATE + INTERVAL '1 year')::date,
  true,
  now()
FROM auth.users u
JOIN public.membership_whitelist w ON lower(w.email) = lower(u.email)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  branch_id = EXCLUDED.branch_id,
  role = EXCLUDED.role,
  membership_active = EXCLUDED.membership_active,
  membership_expires = EXCLUDED.membership_expires,
  approved = EXCLUDED.approved,
  approved_at = EXCLUDED.approved_at;

-- Reset whitelist usage to allow ensure_membership_from_whitelist to mark consumption
UPDATE public.membership_whitelist
SET active = true, consumed_at = NULL, consumed_by = NULL
WHERE consumed_by IS NOT NULL;

SELECT '✅ Membership backfill completed' AS status;
