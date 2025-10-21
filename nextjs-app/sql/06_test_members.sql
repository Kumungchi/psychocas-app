-- Ensure QA accounts exist in the membership whitelist
INSERT INTO public.membership_whitelist (email, first_name, last_name, role, branch_id, note)
VALUES
  ('bunnik.matias@seznam.cz', 'Matias', 'Bunnik', 'member', '550e8400-e29b-41d4-a716-446655440000', 'QA account'),
  ('viceprezident@psychocas.cz', 'Viceprezident', 'Psychočas', 'council', NULL, 'Council QA account')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  note = EXCLUDED.note,
  active = true,
  consumed_at = NULL,
  consumed_by = NULL;

-- Promote existing auth users into active members if they already signed in
INSERT INTO public.memberships (
  user_id,
  email,
  full_name,
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
  CASE
    WHEN w.first_name IS NOT NULL OR w.last_name IS NOT NULL THEN concat_ws(' ', w.first_name, w.last_name)
    ELSE NULL
  END,
  w.branch_id,
  w.role,
  true,
  (CURRENT_DATE + INTERVAL '1 year')::date,
  true,
  now()
FROM auth.users u
JOIN public.membership_whitelist w ON lower(w.email) = lower(u.email)
WHERE lower(u.email) IN ('bunnik.matias@seznam.cz', 'viceprezident@psychocas.cz')
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  branch_id = EXCLUDED.branch_id,
  role = EXCLUDED.role,
  membership_active = EXCLUDED.membership_active,
  membership_expires = EXCLUDED.membership_expires,
  approved = EXCLUDED.approved,
  approved_at = EXCLUDED.approved_at;
