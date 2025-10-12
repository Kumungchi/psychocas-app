-- ========================================
-- TRUSTED USERS & MEMBER APPROVAL SYSTEM
-- This adds support for pre-approved members
-- ========================================

-- Step 1: Add columns to members table for better user management
-- ========================================

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.members(user_id);

-- Update full_name to be computed from first_name + last_name
-- (we keep full_name for backward compatibility)

-- Step 2: Create trusted_users table (pre-approved members)
-- ========================================

ALTER TABLE IF EXISTS public.trusted_users
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

CREATE TABLE IF NOT EXISTS public.trusted_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('member','manager','council','technician')) DEFAULT 'member',
  branch_id uuid REFERENCES public.branches(id),
  added_by uuid REFERENCES public.members(user_id),
  added_at timestamptz DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE public.trusted_users ENABLE ROW LEVEL SECURITY;

-- Only council and managers with @psychočas.cz can manage trusted users
CREATE POLICY "council_manage_trusted_users" ON public.trusted_users
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.members me 
  WHERE me.user_id = auth.uid() 
  AND (me.role = 'council' OR (me.role = 'manager' AND me.email LIKE '%@psychocas.cz'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.members me 
  WHERE me.user_id = auth.uid() 
  AND (me.role = 'council' OR (me.role = 'manager' AND me.email LIKE '%@psychocas.cz'))
));

-- Technicians and managers can read trusted users
CREATE POLICY "staff_read_trusted_users" ON public.trusted_users
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.members me 
  WHERE me.user_id = auth.uid() 
  AND me.role IN ('technician', 'manager', 'council')
));

-- Step 3: Update trigger to check trusted_users on signup
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_role text := 'member';
  new_first_name text := NULL;
  new_last_name text := NULL;
  new_phone text := NULL;
  new_branch_id uuid := NULL;
  is_approved boolean := false;
  trusted_user_record RECORD;
BEGIN
  -- Check if user is in trusted_users table
  SELECT * INTO trusted_user_record
  FROM public.trusted_users
  WHERE email = NEW.email;
  
  IF FOUND THEN
    -- User is pre-approved
    new_role := trusted_user_record.role;
    new_first_name := trusted_user_record.first_name;
    new_last_name := trusted_user_record.last_name;
    new_phone := trusted_user_record.phone;
    new_branch_id := trusted_user_record.branch_id;
    is_approved := true;
  ELSE
    -- Check special emails
    IF NEW.email = 'viceprezident@psychočas.cz' THEN
      new_role := 'council';
      new_first_name := 'Viceprezident';
      new_last_name := 'Psychočas';
      is_approved := true;
    ELSIF NEW.email = 'bunnik.matias@seznam.cz' THEN
      new_role := 'member';
      new_first_name := 'Matias';
      new_last_name := 'Bunnik';
      is_approved := true;
    ELSIF NEW.email LIKE '%@psychočas.cz' THEN
      -- Any @psychočas.cz email gets manager role
      new_role := 'manager';
      is_approved := true;
    ELSE
      -- Unknown user - needs approval
      new_role := 'member';
      is_approved := false;
    END IF;
  END IF;

  -- Insert into members table
  INSERT INTO public.members (
    user_id,
    email,
    role,
    first_name,
    last_name,
    phone,
    branch_id,
    full_name,
    membership_active,
    membership_expires,
    approved,
    approved_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    new_role,
    new_first_name,
    new_last_name,
    new_phone,
    new_branch_id,
    CASE
      WHEN new_first_name IS NOT NULL AND new_last_name IS NOT NULL
      THEN new_first_name || ' ' || new_last_name
      ELSE NULL
    END,
    is_approved,
    CASE WHEN is_approved THEN (CURRENT_DATE + INTERVAL '1 year')::date ELSE NULL END,
    is_approved,
    CASE WHEN is_approved THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    first_name = COALESCE(EXCLUDED.first_name, public.members.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.members.last_name),
    phone = COALESCE(EXCLUDED.phone, public.members.phone),
    branch_id = COALESCE(EXCLUDED.branch_id, public.members.branch_id),
    full_name = COALESCE(EXCLUDED.full_name, public.members.full_name),
    membership_active = EXCLUDED.membership_active,
    membership_expires = EXCLUDED.membership_expires,
    approved = EXCLUDED.approved,
    approved_at = EXCLUDED.approved_at;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
-- ========================================

GRANT ALL ON public.trusted_users TO authenticated, service_role;

-- Step 5: Insert initial trusted users (examples)
-- ========================================

-- Example: Pre-approve some test users
INSERT INTO public.trusted_users (email, first_name, last_name, role, branch_id, notes)
VALUES
  ('bunnik.matias@seznam.cz', 'Matias', 'Bunnik', 'member', '550e8400-e29b-41d4-a716-446655440000', 'Test account - developer'),
  ('viceprezident@psychočas.cz', 'Viceprezident', 'Psychočas', 'council', NULL, 'Council member')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  notes = EXCLUDED.notes;

-- Step 6: Create helper function to approve members
-- ========================================

CREATE OR REPLACE FUNCTION public.approve_member(
  member_user_id uuid,
  approver_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  approver_role text;
BEGIN
  -- Check if approver has permission (council or @psychočas.cz manager)
  SELECT role INTO approver_role
  FROM public.members
  WHERE user_id = approver_user_id;
  
  IF approver_role NOT IN ('council', 'manager') THEN
    RAISE EXCEPTION 'Only council and managers can approve members';
  END IF;
  
  -- If manager, must have @psychočas.cz email
  IF approver_role = 'manager' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = approver_user_id 
      AND email LIKE '%@psychočas.cz'
    ) THEN
      RAISE EXCEPTION 'Only managers with @psychočas.cz email can approve members';
    END IF;
  END IF;
  
  -- Approve the member
  UPDATE public.members
  SET 
    approved = true,
    approved_at = now(),
    approved_by = approver_user_id,
    membership_active = true,
    membership_expires = (CURRENT_DATE + INTERVAL '1 year')::date
  WHERE user_id = member_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Verification
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Trusted users system configured!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '  ✓ trusted_users table created';
  RAISE NOTICE '  ✓ first_name, last_name columns added to members';
  RAISE NOTICE '  ✓ approved column for member approval';
  RAISE NOTICE '  ✓ approve_member() function created';
  RAISE NOTICE '';
  RAISE NOTICE 'Member lifecycle:';
  RAISE NOTICE '  1. User signs up with OTP';
  RAISE NOTICE '  2. If in trusted_users → auto-approved';
  RAISE NOTICE '  3. If @psychočas.cz → auto-approved as manager';
  RAISE NOTICE '  4. Otherwise → needs manual approval';
  RAISE NOTICE '';
  RAISE NOTICE 'Approval permissions:';
  RAISE NOTICE '  • Council members: can approve anyone';
  RAISE NOTICE '  • Managers with @psychočas.cz: can approve anyone';
  RAISE NOTICE '  • Other managers: cannot approve';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Add trusted users via Admin page';
  RAISE NOTICE '========================================';
END $$;
