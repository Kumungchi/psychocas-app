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

-- Memberships table (replaces legacy members/trusted_users)
CREATE TABLE IF NOT EXISTS public.memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  full_name text,
  phone text,
  branch_id uuid REFERENCES public.branches(id),
  role text NOT NULL CHECK (role IN ('member','manager','council','technician','admin')) DEFAULT 'member',
  membership_active boolean NOT NULL DEFAULT false,
  membership_expires date,
  approved boolean DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.memberships(user_id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Whitelist table for onboarding new members
CREATE TABLE IF NOT EXISTS public.membership_whitelist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  phone text,
  role text NOT NULL CHECK (role IN ('member','manager','council','technician','admin')) DEFAULT 'member',
  branch_id uuid REFERENCES public.branches(id),
  note text,
  invited_by uuid REFERENCES public.memberships(user_id),
  invited_at timestamptz DEFAULT now(),
  consumed_at timestamptz,
  consumed_by uuid REFERENCES public.memberships(user_id),
  active boolean DEFAULT true
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
  created_by uuid REFERENCES public.memberships(user_id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.memberships(user_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tokens table
CREATE TABLE IF NOT EXISTS public.tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES public.memberships(user_id) ON DELETE CASCADE,
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
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_whitelist ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES
-- ============================================================================

-- Membership policies
CREATE POLICY "member_read_self" ON public.memberships
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "member_insert_self" ON public.memberships
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "member_update_self" ON public.memberships
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "technician_read_all_members" ON public.memberships
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid() AND me.role IN ('technician','admin')
));

CREATE POLICY "manager_read_branch_members" ON public.memberships
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid() AND me.role = 'manager' AND me.branch_id = memberships.branch_id
));

CREATE POLICY "council_read_all_members" ON public.memberships
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid() AND me.role IN ('council','admin')
));

-- Token policies
CREATE POLICY "member_read_own_tokens" ON public.tokens
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "member_insert_own_tokens" ON public.tokens
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "manager_read_branch_tokens" ON public.tokens
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.memberships me
  JOIN public.memberships owner ON owner.user_id = tokens.user_id
  WHERE me.user_id = auth.uid() AND (
    (me.role = 'manager' AND me.branch_id = owner.branch_id) OR
    me.role IN ('technician','council','admin')
  )
));

-- Redemption policies
CREATE POLICY "manager_read_branch_redemptions" ON public.redemptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid() AND (
    (me.role = 'manager' AND me.branch_id = redemptions.branch_id) OR
    me.role IN ('technician','council','admin')
  )
));

CREATE POLICY "council_read_all_redemptions" ON public.redemptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid() AND me.role IN ('council','admin')
));

CREATE POLICY "redemptions_insert_server_only" ON public.redemptions
FOR INSERT WITH CHECK (false);

-- Partner offer policies
CREATE POLICY "members_read_partner_offers" ON public.partner_offers
FOR SELECT USING (
  partner_offers.active = true
  AND (
    partner_offers.scope = 'national'
    OR EXISTS (
      SELECT 1 FROM public.memberships me
      WHERE me.user_id = auth.uid()
        AND (
          me.role IN ('manager','council','technician','admin')
          OR me.branch_id = partner_offers.branch_id
        )
    )
  )
);

CREATE POLICY "council_manage_partner_offers" ON public.partner_offers
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid()
    AND me.role IN ('council','technician','admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid()
    AND me.role IN ('council','technician','admin')
));

CREATE POLICY "managers_manage_branch_partner_offers" ON public.partner_offers
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid()
    AND me.role = 'manager'
    AND me.email LIKE '%@psychocas.cz'
    AND partner_offers.scope = 'local'
    AND partner_offers.branch_id = me.branch_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid()
    AND me.role = 'manager'
    AND me.email LIKE '%@psychocas.cz'
    AND partner_offers.scope = 'local'
    AND partner_offers.branch_id = me.branch_id
));

-- Membership whitelist policies
CREATE POLICY "staff_manage_membership_whitelist" ON public.membership_whitelist
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid()
    AND (
      me.role IN ('technician','council','admin')
      OR (me.role = 'manager' AND me.email LIKE '%@psychocas.cz')
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.memberships me
  WHERE me.user_id = auth.uid()
    AND (
      me.role IN ('technician','council','admin')
      OR (me.role = 'manager' AND me.email LIKE '%@psychocas.cz')
    )
));

-- 5. TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_memberships_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_memberships_updated_at ON public.memberships;
CREATE TRIGGER set_memberships_updated_at
BEFORE UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.set_memberships_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_token_spam()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tokens
    WHERE user_id = NEW.user_id AND consumed_at IS NULL AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Active token already exists';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_token_spam ON public.tokens;
CREATE TRIGGER trg_token_spam
BEFORE INSERT ON public.tokens
FOR EACH ROW EXECUTE FUNCTION public.prevent_token_spam();

-- 6. FUNCTIONS
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.trusted_users;

CREATE OR REPLACE FUNCTION public.ensure_membership()
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text;
  whitelist_record public.membership_whitelist%ROWTYPE;
  membership_record public.memberships%ROWTYPE;
  expires_at date;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO current_email
  FROM auth.users
  WHERE id = current_user_id;

  IF current_email IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO membership_record
  FROM public.memberships
  WHERE user_id = current_user_id;

  IF FOUND THEN
    IF membership_record.email IS DISTINCT FROM current_email THEN
      UPDATE public.memberships
      SET email = current_email
      WHERE user_id = current_user_id;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO whitelist_record
  FROM public.membership_whitelist
  WHERE lower(email) = lower(current_email)
    AND active IS TRUE
    AND consumed_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  expires_at := (CURRENT_DATE + INTERVAL '1 year')::date;

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
  VALUES (
    current_user_id,
    current_email,
    whitelist_record.first_name,
    whitelist_record.last_name,
    NULLIF(concat_ws(' ', whitelist_record.first_name, whitelist_record.last_name), ''),
    whitelist_record.phone,
    whitelist_record.branch_id,
    whitelist_record.role,
    true,
    expires_at,
    true,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.membership_whitelist
  SET
    consumed_at = now(),
    consumed_by = current_user_id,
    active = false
  WHERE id = whitelist_record.id;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'ensure_membership failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_membership() TO authenticated, service_role;

-- 7. VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public.redemptions_daily AS
SELECT branch_id, date_trunc('day', redeemed_at)::date AS day, count(*) AS total
FROM public.redemptions
GROUP BY 1,2;

CREATE OR REPLACE VIEW public.membership_whitelist_status AS
SELECT
  id,
  email,
  first_name,
  last_name,
  role,
  branch_id,
  note,
  invited_at,
  invited_by,
  consumed_at,
  consumed_by,
  active
FROM public.membership_whitelist;

-- 8. TEST DATA (optional)
-- ============================================================================
INSERT INTO public.branches (id, name, city)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Praha', 'Praha')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.membership_whitelist (email, first_name, last_name, role, branch_id, note)
VALUES
  ('bunnik.matias@seznam.cz', 'Matias', 'Bunnik', 'member', '550e8400-e29b-41d4-a716-446655440000', 'QA account'),
  ('manager@psychocas.cz', 'Manažer', 'Pobočky', 'manager', '550e8400-e29b-41d4-a716-446655440000', 'Lokální manažer'),
  ('tajemnik@psychocas.cz', 'Tajemník', 'Psychočas', 'council', NULL, 'Členská rada'),
  ('technik@psychocas.cz', 'Technik', 'Psychočas', 'technician', NULL, 'Technický účet'),
  ('admin@psychocas.cz', 'Admin', 'Psychočas', 'admin', NULL, 'Administrátor whitelistu')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  note = EXCLUDED.note,
  active = true,
  consumed_at = NULL,
  consumed_by = NULL;

INSERT INTO public.partner_offers (title, description, discount_percentage, scope, active)
VALUES (
  'Testovací celostátní partner',
  'Ukázková sleva dostupná všem členům Psychočas.',
  10,
  'national',
  true
)
ON CONFLICT (title) DO NOTHING;

-- 9. GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.memberships TO authenticated, service_role;
GRANT ALL ON public.tokens TO authenticated, service_role;
GRANT ALL ON public.redemptions TO authenticated, service_role;
GRANT ALL ON public.branches TO authenticated, service_role;
GRANT ALL ON public.partner_offers TO authenticated, service_role;
GRANT ALL ON public.membership_whitelist TO authenticated, service_role;

-- Done!
SELECT 'Database schema deployed successfully! 🎉' AS status;
