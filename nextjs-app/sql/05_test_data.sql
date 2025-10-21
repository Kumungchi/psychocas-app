-- =============================================================
-- TEST DATA FOR MVP VALIDATION
-- =============================================================
-- This seed data powers the health check route and gives QA a
-- predictable dataset covering national offers, branch filtering,
-- and the pre-approved trusted user roles used throughout the app.
-- =============================================================

-- Branches -----------------------------------------------------
INSERT INTO public.branches (id, name, city)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Praha', 'Praha'),
  ('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'Brno', 'Brno')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city;

-- National partner offer ---------------------------------------
INSERT INTO public.partner_offers (title, description, discount_percentage, scope, active)
VALUES (
  'Testovací celostátní partner',
  'Ukázková sleva dostupná všem členům Psychočas.',
  10,
  'national',
  true
)
ON CONFLICT (title) DO UPDATE SET
  description = EXCLUDED.description,
  discount_percentage = EXCLUDED.discount_percentage,
  active = EXCLUDED.active;

-- Local partner offers -----------------------------------------
INSERT INTO public.partner_offers (title, description, discount_percentage, scope, branch_id, city, active)
VALUES
  (
    'Pražská kavárna',
    '20% sleva na kávu pro členy z Prahy.',
    20,
    'local',
    '550e8400-e29b-41d4-a716-446655440000',
    'Praha',
    true
  ),
  (
    'Brněnské wellness',
    '15% sleva na wellness služby pro brněnskou pobočku.',
    15,
    'local',
    '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    'Brno',
    true
  )
ON CONFLICT (title) DO UPDATE SET
  description = EXCLUDED.description,
  discount_percentage = EXCLUDED.discount_percentage,
  scope = EXCLUDED.scope,
  branch_id = EXCLUDED.branch_id,
  city = EXCLUDED.city,
  active = EXCLUDED.active;

-- Membership whitelist -----------------------------------------
INSERT INTO public.membership_whitelist (email, first_name, last_name, role, branch_id, note)
VALUES
  ('bunnik.matias@seznam.cz', 'Matias', 'Bunnik', 'member', '550e8400-e29b-41d4-a716-446655440000', 'Předem schválený člen pro QA'),
  ('member.tester@psychocas.test', 'Test', 'Člen', 'member', '550e8400-e29b-41d4-a716-446655440000', 'Ukázkový člen pro testování'),
  ('manager@psychocas.cz', 'Manažer', 'Pobočky', 'manager', '550e8400-e29b-41d4-a716-446655440000', 'Manažerský účet s přístupem k lokálním partnerům'),
  ('tajemnik@psychocas.cz', 'Tajemník', 'Psychočas', 'council', NULL, 'Členská rada – národní přehled'),
  ('viceprezident@psychocas.cz', 'Viceprezident', 'Psychočas', 'council', NULL, 'Členská rada – národní přehled'),
  ('prezident@psychocas.cz', 'Prezident', 'Psychočas', 'council', NULL, 'Členská rada – národní přehled'),
  ('technik@psychocas.cz', 'Technik', 'Psychočas', 'technician', NULL, 'Technická role pro provoz aplikace'),
  ('admin@psychocas.cz', 'Admin', 'Psychočas', 'admin', NULL, 'Administrátorský účet pro správu whitelistu a členství')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  note = EXCLUDED.note,
  active = true,
  consumed_at = NULL,
  consumed_by = NULL;

-- Seed active memberships for QA accounts ----------------------
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
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  branch_id = EXCLUDED.branch_id,
  role = EXCLUDED.role,
  membership_active = EXCLUDED.membership_active,
  membership_expires = EXCLUDED.membership_expires,
  approved = EXCLUDED.approved,
  approved_at = EXCLUDED.approved_at;

-- Reminder ------------------------------------------------------
-- `ensure_membership_from_whitelist` RPC will hydrate `memberships` records for
-- whitelisted emails the moment they authenticate. Seeding the
-- whitelist ensures QA accounts are onboarded automatically.
