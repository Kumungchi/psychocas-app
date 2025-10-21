-- SIMPLE TEST DATA FIX
-- Just create basic member record for testing

-- 1. Check what user_id we have in auth.users
SELECT 'AUTH USER:' as info, id, email, created_at 
FROM auth.users 
WHERE email = 'bunnik.matias@seznam.cz';

-- 2. Delete any existing problematic membership record
DELETE FROM public.memberships WHERE email = 'bunnik.matias@seznam.cz';

INSERT INTO public.memberships (
  user_id,
  email,
  role,
  first_name,
  last_name,
  full_name,
  membership_active,
  membership_expires,
  approved,
  approved_at
)
SELECT
  au.id,
  'bunnik.matias@seznam.cz',
  'member',
  'Matias',
  'Bunnik',
  'Matias Bunnik',
  true,
  (CURRENT_DATE + INTERVAL '1 year')::date,
  true,
  now()
FROM auth.users au
WHERE au.email = 'bunnik.matias@seznam.cz';

-- 4. Verify it worked
SELECT
  'CREATED MEMBER:' as info,
  user_id,
  email,
  role,
  first_name,
  last_name,
  membership_active,
  approved
FROM public.memberships
WHERE email = 'bunnik.matias@seznam.cz';