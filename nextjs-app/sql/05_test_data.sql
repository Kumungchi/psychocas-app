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

-- Trusted user directory ---------------------------------------
INSERT INTO public.trusted_users (email, first_name, last_name, role, branch_id, notes)
VALUES
  ('member.tester@psychocas.test', 'Test', 'Člen', 'member', '550e8400-e29b-41d4-a716-446655440000', 'Ukázkový člen pro testování'),
  ('manager@psychocas.cz', 'Manažer', 'Pobočky', 'manager', '550e8400-e29b-41d4-a716-446655440000', 'Manažerský účet s přístupem k lokálním partnerům'),
  ('tajemnik@psychocas.cz', 'Tajemník', 'Psychočas', 'council', NULL, 'Členská rada – národní přehled'),
  ('viceprezident@psychocas.cz', 'Viceprezident', 'Psychočas', 'council', NULL, 'Členská rada – národní přehled'),
  ('prezident@psychocas.cz', 'Prezident', 'Psychočas', 'council', NULL, 'Členská rada – národní přehled'),
  ('technik@psychocas.cz', 'Technik', 'Psychočas', 'technician', NULL, 'Technická role pro provoz aplikace')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  notes = EXCLUDED.notes;

-- Reminder ------------------------------------------------------
-- The member rows are created automatically by the signup trigger.
-- After seeding, run `npm run seed:supabase` to provision auth users
-- and activate their member profiles for manual QA.
