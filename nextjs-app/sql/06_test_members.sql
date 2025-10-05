-- Insert test members for development
-- Note: These will be created automatically when they sign in via OTP for the first time
-- However, we need to ensure they have the correct roles set

-- Update member role for bunnik.matias@seznam.cz to 'member'
DO $$
BEGIN
  -- Check if user exists by email
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'bunnik.matias@seznam.cz') THEN
    -- Update member role
    UPDATE public.members 
    SET 
      role = 'member',
      membership_active = true,
      membership_expires = (CURRENT_DATE + INTERVAL '1 year')::date,
      full_name = 'Matias Bunnik'
    WHERE email = 'bunnik.matias@seznam.cz';
    
    RAISE NOTICE 'Member role updated for bunnik.matias@seznam.cz';
  ELSE
    RAISE NOTICE 'User bunnik.matias@seznam.cz not found - will be created on first OTP login';
  END IF;
END $$;

-- Update member role for viceprezident@psychočas.cz to 'council' (highest admin role)
DO $$
BEGIN
  -- Check if user exists by email
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'viceprezident@psychočas.cz') THEN
    -- Update member role
    UPDATE public.members 
    SET 
      role = 'council',
      membership_active = true,
      membership_expires = (CURRENT_DATE + INTERVAL '1 year')::date,
      full_name = 'Viceprezident'
    WHERE email = 'viceprezident@psychočas.cz';
    
    RAISE NOTICE 'Council role updated for viceprezident@psychočas.cz';
  ELSE
    RAISE NOTICE 'User viceprezident@psychočas.cz not found - will be created on first OTP login';
  END IF;
END $$;

-- Create a function to automatically set role based on email domain after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_role text := 'member'; -- default role
  new_full_name text;
BEGIN
  -- Set role based on email
  IF NEW.email = 'viceprezident@psychočas.cz' THEN
    new_role := 'council';
    new_full_name := 'Viceprezident';
  ELSIF NEW.email = 'bunnik.matias@seznam.cz' THEN
    new_role := 'member';
    new_full_name := 'Matias Bunnik';
  ELSE
    new_role := 'member';
    new_full_name := NULL;
  END IF;

  -- Insert into members table (using INSERT with ON CONFLICT to avoid duplicates)
  INSERT INTO public.members (user_id, email, role, membership_active, membership_expires, full_name)
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
    -- Log error but don't fail the auth
    RAISE WARNING 'Error creating member record: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create member record on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
