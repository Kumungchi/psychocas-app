-- =============================================================================
-- MIGRATION 12: Make tokens.discount_id optional
-- =============================================================================
-- Tokens can now represent general membership proof (no specific discount)
-- OR a specific discount redemption. The original schema required discount_id
-- NOT NULL, but the home-screen "generate token" flow doesn't pick a discount.
--
-- Run this in Supabase SQL Editor before deploying the updated Edge Function.
-- =============================================================================

ALTER TABLE public.tokens
  ALTER COLUMN discount_id DROP NOT NULL;
