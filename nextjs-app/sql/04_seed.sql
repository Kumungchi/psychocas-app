-- =============================================================================
-- PSYCHOČAS — TEST SEED DATA
-- =============================================================================
-- Run this AFTER 01_schema.sql, 02_rls_policies.sql, 03_triggers.sql.
-- Creates test data for local development and QA.
--
-- ⚠️  HOW TO SWAP FOR REAL DATA:
-- Each section below is clearly labeled. When you're ready for production:
--   1. Replace branch names/cities with real Psychočas chapters
--   2. Replace whitelist emails with real member emails from your Excel
--   3. Replace partners with actual partner businesses
--   4. Delete the "TEST ONLY" entries (clearly marked below)
--   5. Keep the structure — just swap the VALUES
--
-- NOTE: Members are NOT seeded here. Member rows are created automatically
-- when a whitelisted user logs in for the first time.
-- =============================================================================


-- =============================================================================
-- BRANCHES
-- =============================================================================
-- 🔄 SWAP FOR PRODUCTION: Replace with your real Psychočas chapter names.
-- Keep the fixed UUIDs or generate new ones — just update all references.

INSERT INTO public.branches (id, name, city) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Praha',    'Praha'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Brno',     'Brno'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Olomouc',  'Olomouc'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Ostrava',  'Ostrava'),
  ('550e8400-e29b-41d4-a716-446655440005', 'České Budějovice', 'České Budějovice')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city;


-- =============================================================================
-- MEMBER WHITELIST
-- =============================================================================
-- 🔄 SWAP FOR PRODUCTION: Import your real member list from Excel.
--    Each row = one person who is allowed to log in.
--    Set membership_expires_at to their actual expiry date.
--    Set is_active = false to block someone without deleting them.
--
-- After first login, the app creates a member row automatically.
-- To assign roles (manager/board/technician), update the members table:
--   UPDATE members SET role = 'manager' WHERE email = '...';

INSERT INTO public.member_whitelist (email, full_name, branch_id, membership_expires_at, is_active) VALUES

  -- ✅ REAL ACCOUNT — your admin/technician account
  ('bunnik.matias@seznam.cz', 'Matias Bunnik',
    '550e8400-e29b-41d4-a716-446655440001', '2027-06-15', true),

  -- 🧪 TEST ONLY — remove these for production
  ('clen@psychocas.test',       'Jan Novák',         '550e8400-e29b-41d4-a716-446655440001', '2027-06-15', true),
  ('spravce@psychocas.test',    'Eva Svobodová',     '550e8400-e29b-41d4-a716-446655440001', '2027-06-15', true),
  ('vybor@psychocas.test',      'Petr Dvořák',       '550e8400-e29b-41d4-a716-446655440002', '2027-06-15', true),
  ('technik@psychocas.test',    'Technik Systému',   '550e8400-e29b-41d4-a716-446655440001', '2027-06-15', true),
  ('brno.clen@psychocas.test',  'Marie Procházková', '550e8400-e29b-41d4-a716-446655440002', '2027-06-15', true),
  ('vyprsel@psychocas.test',    'Karel Expirovaný',  '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', true),
  ('neaktivni@psychocas.test',  'Alena Neaktivní',   '550e8400-e29b-41d4-a716-446655440001', '2027-06-15', false)

ON CONFLICT (email) DO UPDATE SET
  full_name             = EXCLUDED.full_name,
  branch_id             = EXCLUDED.branch_id,
  membership_expires_at = EXCLUDED.membership_expires_at,
  is_active             = EXCLUDED.is_active;


-- =============================================================================
-- PARTNERS
-- =============================================================================
-- 🔄 SWAP FOR PRODUCTION: Replace with your actual partner businesses.
--    branch_id = NULL means national (all members see it).
--    branch_id = '<uuid>' means local to that branch only.

INSERT INTO public.partners (id, name, description, category, website, address, branch_id, is_active) VALUES

  -- National partners (visible to all members)
  ('a0000000-0000-0000-0000-000000000001', 'Knihkupectví Neoluxor',
    'Největší knihkupectví v ČR — sleva na odbornou literaturu.',
    'shop', 'https://neoluxor.cz', 'Národní 9, Praha 1', NULL, true),

  ('a0000000-0000-0000-0000-000000000002', 'Mindfulness App',
    'Roční předplatné meditační aplikace.',
    'service', NULL, NULL, NULL, true),

  -- Praha local partners
  ('a0000000-0000-0000-0000-000000000003', 'Café Molo',
    'Útulná kavárna u Vltavy.',
    'cafe', NULL, 'Náplavka 2, Praha 2',
    '550e8400-e29b-41d4-a716-446655440001', true),

  ('a0000000-0000-0000-0000-000000000004', 'Yoga Studio Vinohrady',
    'Jógové lekce pro začátečníky i pokročilé.',
    'service', NULL, 'Vinohradská 50, Praha 3',
    '550e8400-e29b-41d4-a716-446655440001', true),

  -- Brno local partner
  ('a0000000-0000-0000-0000-000000000005', 'Wellness Brno',
    'Relaxační centrum se saunou a masážemi.',
    'service', NULL, 'Masarykova 10, Brno',
    '550e8400-e29b-41d4-a716-446655440002', true)

ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  website     = EXCLUDED.website,
  address     = EXCLUDED.address,
  branch_id   = EXCLUDED.branch_id,
  is_active   = EXCLUDED.is_active;


-- =============================================================================
-- DISCOUNTS
-- =============================================================================
-- Discounts need created_by → members.id, which doesn't exist until someone
-- logs in. There are two ways to seed discounts:
--
-- OPTION A (recommended): Log in as your admin account first, then run:
--   INSERT INTO discounts (partner_id, title, discount_value, is_active, created_by)
--   VALUES ('<partner_id>', '...', '...', true, '<your_member_id>');
--
-- OPTION B: Use the ManagePage UI to create discounts after first login.
--
-- Example discount inserts (replace <ADMIN_MEMBER_ID> after first login):
--
-- INSERT INTO public.discounts (partner_id, title, discount_value, is_active, created_by) VALUES
--   ('a0000000-0000-0000-0000-000000000001', '10 % sleva na psychologickou literaturu', '10 %',   true, '<ADMIN_MEMBER_ID>'),
--   ('a0000000-0000-0000-0000-000000000002', '3 měsíce zdarma',                        'zdarma', true, '<ADMIN_MEMBER_ID>'),
--   ('a0000000-0000-0000-0000-000000000003', '15 % na všechny nápoje',                 '15 %',   true, '<ADMIN_MEMBER_ID>'),
--   ('a0000000-0000-0000-0000-000000000004', 'První lekce zdarma',                     'zdarma', true, '<ADMIN_MEMBER_ID>'),
--   ('a0000000-0000-0000-0000-000000000005', '20 % na wellness balíček',               '20 %',   true, '<ADMIN_MEMBER_ID>');


-- =============================================================================
-- ROLE ASSIGNMENT GUIDE
-- =============================================================================
-- After test users log in for the first time, assign their roles:
--
-- 🧪 TEST ONLY — run these after each test user has logged in once:
--
-- UPDATE public.members SET role = 'technician' WHERE email = 'bunnik.matias@seznam.cz';
-- UPDATE public.members SET role = 'manager'    WHERE email = 'spravce@psychocas.test';
-- UPDATE public.members SET role = 'board'      WHERE email = 'vybor@psychocas.test';
-- UPDATE public.members SET role = 'technician' WHERE email = 'technik@psychocas.test';
-- (clen@psychocas.test and brno.clen@psychocas.test stay as 'member' — the default)


-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  b_count integer;
  w_count integer;
  p_count integer;
BEGIN
  SELECT count(*) INTO b_count FROM public.branches;
  SELECT count(*) INTO w_count FROM public.member_whitelist;
  SELECT count(*) INTO p_count FROM public.partners;

  RAISE NOTICE '';
  RAISE NOTICE '=== SEED DATA LOADED ===';
  RAISE NOTICE 'Branches:  %', b_count;
  RAISE NOTICE 'Whitelist: %', w_count;
  RAISE NOTICE 'Partners:  %', p_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Test accounts (log in with OTP):';
  RAISE NOTICE '  bunnik.matias@seznam.cz   → technician (set role after first login)';
  RAISE NOTICE '  clen@psychocas.test       → member (default)';
  RAISE NOTICE '  spravce@psychocas.test    → manager (set role after first login)';
  RAISE NOTICE '  vybor@psychocas.test      → board (set role after first login)';
  RAISE NOTICE '  technik@psychocas.test    → technician (set role after first login)';
  RAISE NOTICE '  vyprsel@psychocas.test    → expired membership';
  RAISE NOTICE '  neaktivni@psychocas.test  → deactivated';
  RAISE NOTICE '';
  RAISE NOTICE 'After first login, run the role UPDATE statements above.';
  RAISE NOTICE 'Then create discounts via ManagePage or SQL.';
END $$;
