-- =============================================================================
-- PSYCHOČAS — CLEANUP LEGACY auth.users TRIGGERS
-- =============================================================================
-- Legacy triggers from the old prototype referenced removed tables
-- (profiles, whitelist, memberships, membership_whitelist) and blocked
-- new auth user creation with:
--   "Database error creating new user"
--
-- This migration removes those obsolete triggers/functions.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_from_whitelist ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_from_whitelist();
