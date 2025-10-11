-- ============================================================================
-- PSYCHOČAS APP - KOMPLETNÍ DATABÁZOVÉ SCHÉMA
-- ============================================================================
-- Spusťte tento celý soubor v Supabase SQL Editoru
-- Pořadí: Extensions → Tables → RLS → Policies → Triggers → Views → Test Data
-- ============================================================================

-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES
-- ============================================================================

-- Branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city text,
  created_at timestamptz DEFAULT now()
);

-- Members table
CREATE TABLE IF NOT EXISTS public.members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  branch_id uuid REFERENCES public.branches(id),
  role text NOT NULL CHECK (role IN ('member','manager','council','technician')) DEFAULT 'member',
  membership_active boolean NOT NULL DEFAULT false,
  membership_expires date,
  created_at timestamptz DEFAULT now()
);

-- Partner offers table
CREATE TABLE IF NOT EXISTS public.partner_offers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  discount_code text,
  discount_percentage numeric(5,2),
  scope text NOT NULL CHECK (scope IN ('national','local')),
  branch_id uuid REFERENCES public.branches(id),
  city text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.members(user_id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.members(user_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tokens table
CREATE TABLE IF NOT EXISTS public.tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES public.members(user_id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

-- Redemptions table
CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id uuid REFERENCES public.tokens(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- 3. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES
-- ============================================================================

-- Member policies
CREATE POLICY "member_read_self" ON public.members
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "technician_read_all_members" ON public.members
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me WHERE me.user_id=auth.uid() AND me.role='technician'
));

CREATE POLICY "manager_read_branch_members" ON public.members
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id=auth.uid() AND me.role='manager' AND me.branch_id=members.branch_id
));

-- Token policies
CREATE POLICY "member_read_own_tokens" ON public.tokens
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "member_insert_own_tokens" ON public.tokens
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "manager_read_branch_tokens" ON public.tokens
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me
  JOIN public.members owner ON owner.user_id = tokens.user_id
  WHERE me.user_id = auth.uid() AND me.role='manager' AND me.branch_id=owner.branch_id
));

-- Redemption policies
CREATE POLICY "manager_read_branch_redemptions" ON public.redemptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id=auth.uid() AND me.role='manager' AND me.branch_id=redemptions.branch_id
));

CREATE POLICY "council_read_all_redemptions" ON public.redemptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me WHERE me.user_id=auth.uid() AND me.role='council'
));

-- Insert redemptions only from server-side function
CREATE POLICY "redemptions_insert_server_only" ON public.redemptions
FOR INSERT WITH CHECK (false);

-- Partner offers policies
CREATE POLICY "members_read_partner_offers" ON public.partner_offers
FOR SELECT USING (
  partner_offers.active = true
  AND (
    partner_offers.scope = 'national'
    OR EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND (
          me.role IN ('manager','council','technician')
          OR me.branch_id = partner_offers.branch_id
        )
    )
  )
);

CREATE POLICY "council_manage_partner_offers" ON public.partner_offers
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id = auth.uid()
    AND me.role IN ('council','technician')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id = auth.uid()
    AND me.role IN ('council','technician')
));

CREATE POLICY "managers_manage_branch_partner_offers" ON public.partner_offers
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id = auth.uid()
    AND me.role = 'manager'
    AND me.email LIKE '%@psychocas.cz'
    AND partner_offers.scope = 'local'
    AND partner_offers.branch_id = me.branch_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id = auth.uid()
    AND me.role = 'manager'
    AND me.email LIKE '%@psychocas.cz'
    AND partner_offers.scope = 'local'
    AND partner_offers.branch_id = me.branch_id
));

-- 5. TRIGGERS
-- ============================================================================

-- Anti-spam trigger (1 active token at a time)
CREATE OR REPLACE FUNCTION public.prevent_token_spam()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tokens
    WHERE user_id=NEW.user_id AND consumed_at IS NULL AND expires_at>now()
  ) THEN
    RAISE EXCEPTION 'Active token already exists';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_token_spam ON public.tokens;
CREATE TRIGGER trg_token_spam
BEFORE INSERT ON public.tokens
FOR EACH ROW EXECUTE FUNCTION public.prevent_token_spam();

-- 6. VIEWS
-- ============================================================================

-- Daily view for stats
CREATE OR REPLACE VIEW public.redemptions_daily AS
SELECT branch_id, date_trunc('day', redeemed_at)::date AS day, count(*) AS total
FROM public.redemptions
GROUP BY 1,2;

-- 7. TEST DATA
-- ============================================================================

-- Create one test branch
INSERT INTO public.branches (id, name, city)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Praha - testovací pobočka', 'Praha')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.partner_offers (title, description, discount_percentage, scope, active)
VALUES ('Testovací celostátní partner', 'Ukázková sleva dostupná všem členům Psychočas.', 10, 'national', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SETUP COMPLETE! 
-- ============================================================================
-- Next steps:
-- 1. Check health at: http://localhost:3000/test (should show ✅ for database)
-- 2. Create test users in Authentication → Users
-- 3. Add member records manually with user UUIDs
-- 4. Deploy Edge Functions
-- ============================================================================

-- For manual testing after user creation:
-- INSERT INTO public.members (user_id, email, full_name, branch_id, role, membership_active) 
-- VALUES ('[USER_UUID_FROM_AUTH]', 'test@example.com', 'Test User', '550e8400-e29b-41d4-a716-446655440000', 'member', true);

SELECT 'Database schema deployed successfully! 🎉' AS status;