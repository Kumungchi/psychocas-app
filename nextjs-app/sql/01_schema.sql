-- =============================================================================
-- PSYCHOČAS — DATABASE SCHEMA
-- =============================================================================
-- This creates all 7 tables from scratch.
-- Run this ONCE on a fresh Supabase project (SQL Editor → paste → Run).
--
-- Table order matters because of foreign keys:
--   branches → member_whitelist → members → partners → discounts → tokens → redemptions
--
-- Every table uses UUID primary keys (standard for Supabase).
-- Timestamps are stored as `timestamptz` (timezone-aware) — Supabase default.
-- =============================================================================

-- UUID generation (Supabase has this by default, but just in case)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- 1. BRANCHES
-- =============================================================================
-- A branch is a local chapter of Psychočas (e.g. "Praha", "Brno").
-- Discounts can be national (no branch) or local (linked to a branch).
-- Members belong to exactly one branch.

CREATE TABLE IF NOT EXISTS public.branches (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text        NOT NULL,           -- e.g. "Praha"
  city       text        NOT NULL,           -- e.g. "Praha" (can differ from name)
  created_at timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 2. MEMBER_WHITELIST
-- =============================================================================
-- The pre-approved member list — imported from the association's Excel/spreadsheet.
-- Only emails in this table can log in (checked before OTP is sent).
-- This is the source of truth for "who is a member" and "when does membership expire".
--
-- WHY separate from `members`?
-- The whitelist exists BEFORE anyone logs in. It's managed by board/managers.
-- The `members` row is created automatically on first login (by the app, not a trigger).

CREATE TABLE IF NOT EXISTS public.member_whitelist (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 text        UNIQUE NOT NULL,
  full_name             text        NOT NULL,    -- "Jan Novák"
  branch_id             uuid        NOT NULL REFERENCES public.branches(id),
  membership_expires_at date        NOT NULL,    -- e.g. 2026-06-15
  is_active             boolean     NOT NULL DEFAULT true,
  notes                 text,                    -- optional admin notes
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 3. MEMBERS
-- =============================================================================
-- Created automatically when a whitelisted user logs in for the first time.
-- Links a Supabase Auth user (auth.users.id) to our whitelist entry.
--
-- WHY a separate `id` and `user_id`?
-- `user_id` is Supabase Auth's UUID — we don't control it.
-- `id` is OUR primary key — used as FK in tokens, redemptions, etc.
-- This keeps our schema independent from Supabase Auth internals.

CREATE TABLE IF NOT EXISTS public.members (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid        UNIQUE NOT NULL,     -- FK to auth.users (not enforced here, Supabase manages it)
  whitelist_id  uuid        NOT NULL REFERENCES public.member_whitelist(id),
  full_name     text        NOT NULL,
  email         text        UNIQUE NOT NULL,
  branch_id     uuid        NOT NULL REFERENCES public.branches(id),
  role          text        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('member', 'manager', 'board', 'technician')),
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. PARTNERS
-- =============================================================================
-- A partner is a business that offers discounts to Psychočas members.
-- e.g. "Café Molo", "Bookshop Neoluxor", "Wellness Brno"
--
-- Partners can be:
--   - National (branch_id IS NULL) → visible to all members
--   - Local (branch_id IS NOT NULL) → visible to that branch + managers/board

CREATE TABLE IF NOT EXISTS public.partners (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text        NOT NULL,           -- "Café Molo"
  description text,                           -- optional longer description
  logo_url    text,                           -- URL to partner logo (Supabase Storage or external)
  category    text        NOT NULL DEFAULT 'other'
                          CHECK (category IN ('cafe', 'shop', 'event', 'service', 'other')),
  website     text,                           -- "https://cafemolo.cz"
  instagram   text,                           -- "@cafemolo" or full URL
  address     text,                           -- "Náměstí 12, Praha 1"
  branch_id   uuid        REFERENCES public.branches(id),  -- NULL = national
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 5. DISCOUNTS
-- =============================================================================
-- A specific offer from a partner. One partner can have multiple discounts.
-- e.g. Partner "Café Molo" → Discount "15 % na všechny nápoje"
--
-- WHY separate from partners?
-- A café might offer "15% on drinks" AND "free cookie with purchase".
-- The old schema (partner_offers) couldn't model this — it was one row per offer.

CREATE TABLE IF NOT EXISTS public.discounts (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id     uuid        NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  title          text        NOT NULL,        -- "15 % sleva na všechny nápoje"
  description    text,                        -- optional detail
  discount_value text        NOT NULL,        -- flexible: "15 %", "2+1", "zdarma káva"
  valid_from     date,                        -- NULL = no start restriction
  valid_until    date,                        -- NULL = no end date
  is_active      boolean     NOT NULL DEFAULT true,
  created_by     uuid        NOT NULL REFERENCES public.members(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 6. TOKENS
-- =============================================================================
-- Generated when a member wants to USE a specific discount at point of sale.
-- Each token lives for 3 minutes and is single-use.
--
-- Two ways to validate:
--   1. QR code → encodes URL with `token_hash` → shop scans → opens /v/:tokenHash
--   2. Manual → member shows `code` (e.g. "PSYCH-A7B2C3") → shop types it in
--
-- WHY both token_hash and code?
-- `token_hash` is a full UUID — good for URLs, impossible to guess.
-- `code` is short and human-readable — backup when scanning doesn't work.

CREATE TABLE IF NOT EXISTS public.tokens (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   uuid        NOT NULL REFERENCES public.members(id),
  discount_id uuid        NOT NULL REFERENCES public.discounts(id),
  token_hash  uuid        UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  code        text        UNIQUE NOT NULL,    -- "PSYCH-A7B2C3"
  expires_at  timestamptz NOT NULL,           -- created_at + 3 minutes
  redeemed_at timestamptz,                    -- NULL = not yet used
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 7. REDEMPTIONS
-- =============================================================================
-- Created when a token is successfully validated (scanned/entered by shop).
-- This is the analytics table — tracks who used what, where, and when.
--
-- WHY denormalize discount_id, partner_id, member_id, branch_id?
-- Stats queries need these fields constantly. Without denormalization,
-- every stats query would need 3-4 JOINs. With it, a simple GROUP BY works.
-- The trade-off (slight data duplication) is worth it for query speed.

CREATE TABLE IF NOT EXISTS public.redemptions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id    uuid        NOT NULL REFERENCES public.tokens(id),
  discount_id uuid        NOT NULL REFERENCES public.discounts(id),
  partner_id  uuid        NOT NULL REFERENCES public.partners(id),
  member_id   uuid        NOT NULL REFERENCES public.members(id),
  branch_id   uuid        NOT NULL REFERENCES public.branches(id),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- INDEXES
-- =============================================================================
-- Speed up the most common queries.
-- Supabase auto-creates indexes on primary keys and UNIQUE columns.
-- We add a few more for queries our app runs frequently.

-- Find active tokens for a member (anti-spam check)
CREATE INDEX IF NOT EXISTS idx_tokens_member_active
  ON public.tokens (member_id, expires_at)
  WHERE redeemed_at IS NULL;

-- Look up token by hash (public validation page)
CREATE INDEX IF NOT EXISTS idx_tokens_hash
  ON public.tokens (token_hash);

-- Stats: redemptions by branch + time
CREATE INDEX IF NOT EXISTS idx_redemptions_branch_time
  ON public.redemptions (branch_id, redeemed_at);

-- Stats: redemptions by partner
CREATE INDEX IF NOT EXISTS idx_redemptions_partner
  ON public.redemptions (partner_id, redeemed_at);

-- Whitelist lookup by email (login check)
CREATE INDEX IF NOT EXISTS idx_whitelist_email
  ON public.member_whitelist (email);

-- Discounts by partner (discount list page)
CREATE INDEX IF NOT EXISTS idx_discounts_partner
  ON public.discounts (partner_id)
  WHERE is_active = true;
