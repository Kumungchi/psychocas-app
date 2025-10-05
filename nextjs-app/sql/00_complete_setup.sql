-- ========================================
-- COMPLETE DATABASE SETUP SCRIPT
-- Run this ONCE in Supabase SQL Editor
-- ========================================

-- Step 1: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create tables in correct order
-- ========================================

-- Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city text,
  created_at timestamptz DEFAULT now()
);

-- Create members table
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

-- Create tokens table
CREATE TABLE IF NOT EXISTS public.tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES public.members(user_id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

-- Create redemptions table
CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id uuid REFERENCES public.tokens(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- Step 3: Enable Row Level Security
-- ========================================

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
-- ========================================

-- Members policies
CREATE POLICY "members_read_self" ON public.members
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_insert_on_signup" ON public.members
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_self" ON public.members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "technician_read_all_members" ON public.members
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me WHERE me.user_id = auth.uid() AND me.role = 'technician'
));

CREATE POLICY "manager_read_branch_members" ON public.members
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id = auth.uid() AND me.role = 'manager' AND me.branch_id = members.branch_id
));

CREATE POLICY "council_read_all_members" ON public.members
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me WHERE me.user_id = auth.uid() AND me.role = 'council'
));

-- Tokens policies
CREATE POLICY "member_read_own_tokens" ON public.tokens
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "member_insert_own_tokens" ON public.tokens
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "manager_read_branch_tokens" ON public.tokens
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me
  JOIN public.members owner ON owner.user_id = tokens.user_id
  WHERE me.user_id = auth.uid() AND me.role = 'manager' AND me.branch_id = owner.branch_id
));

-- Redemptions policies
CREATE POLICY "manager_read_branch_redemptions" ON public.redemptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me
  WHERE me.user_id = auth.uid() AND me.role = 'manager' AND me.branch_id = redemptions.branch_id
));

CREATE POLICY "council_read_all_redemptions" ON public.redemptions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.members me WHERE me.user_id = auth.uid() AND me.role = 'council'
));

CREATE POLICY "redemptions_insert_server_only" ON public.redemptions
FOR INSERT WITH CHECK (false);

-- Branches policies
CREATE POLICY "branches_read_all" ON public.branches
FOR SELECT TO authenticated USING (true);

-- Step 5: Create trigger function for auto-creating member records
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_role text := 'member';
  new_full_name text := NULL;
BEGIN
  -- Set role and name based on email
  IF NEW.email = 'viceprezident@psychočas.cz' THEN
    new_role := 'council';
    new_full_name := 'Viceprezident';
  ELSIF NEW.email = 'bunnik.matias@seznam.cz' THEN
    new_role := 'member';
    new_full_name := 'Matias Bunnik';
  ELSIF NEW.email LIKE '%@psychočas.cz' THEN
    -- Any @psychočas.cz email gets manager role
    new_role := 'manager';
    new_full_name := NULL;
  ELSE
    new_role := 'member';
    new_full_name := NULL;
  END IF;

  -- Insert into members table
  INSERT INTO public.members (
    user_id,
    email,
    role,
    membership_active,
    membership_expires,
    full_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    new_role,
    true,
    (CURRENT_DATE + INTERVAL '1 year')::date,
    new_full_name
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    membership_active = EXCLUDED.membership_active,
    membership_expires = EXCLUDED.membership_expires,
    full_name = COALESCE(EXCLUDED.full_name, public.members.full_name);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger
-- ========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Grant permissions
-- ========================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.members TO authenticated, service_role;
GRANT ALL ON public.tokens TO authenticated, service_role;
GRANT ALL ON public.redemptions TO authenticated, service_role;
GRANT ALL ON public.branches TO authenticated, service_role;

-- Step 8: Insert test branch (optional)
-- ========================================

INSERT INTO public.branches (name, city)
VALUES ('Psychočas Brno', 'Brno')
ON CONFLICT DO NOTHING;

-- Step 9: Verification
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Database setup completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ branches';
  RAISE NOTICE '  ✓ members';
  RAISE NOTICE '  ✓ tokens';
  RAISE NOTICE '  ✓ redemptions';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies enabled: ✓';
  RAISE NOTICE 'Trigger configured: ✓';
  RAISE NOTICE 'Permissions granted: ✓';
  RAISE NOTICE '';
  RAISE NOTICE 'Test accounts ready:';
  RAISE NOTICE '  • bunnik.matias@seznam.cz → member';
  RAISE NOTICE '  • viceprezident@psychočas.cz → council';
  RAISE NOTICE '  • any @psychočas.cz email → manager';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Try OTP login at /login';
  RAISE NOTICE '========================================';
END $$;
