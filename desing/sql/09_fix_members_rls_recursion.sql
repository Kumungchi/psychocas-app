-- =============================================================================
-- PSYCHOČAS — FIX RLS RECURSION ON members
-- =============================================================================
-- Some policies queried public.members from within policies on public.members,
-- which can trigger infinite recursion for authenticated users.
-- This migration introduces helper functions and rewrites policies safely.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_member_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_member_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.branch_id
  FROM public.members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.member_branch_id(p_member_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.branch_id
  FROM public.members m
  WHERE m.id = p_member_id
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "manager_read_branch_members" ON public.members;
CREATE POLICY "manager_read_branch_members"
  ON public.members FOR SELECT
  TO authenticated
  USING (
    public.current_member_role() = 'manager'
    AND members.branch_id = public.current_member_branch_id()
  );

DROP POLICY IF EXISTS "admin_read_all_members" ON public.members;
CREATE POLICY "admin_read_all_members"
  ON public.members FOR SELECT
  TO authenticated
  USING (
    public.current_member_role() IN ('board', 'technician')
  );

DROP POLICY IF EXISTS "manager_read_branch_tokens" ON public.tokens;
CREATE POLICY "manager_read_branch_tokens"
  ON public.tokens FOR SELECT
  TO authenticated
  USING (
    public.current_member_role() = 'manager'
    AND public.current_member_branch_id() = public.member_branch_id(tokens.member_id)
  );

DROP POLICY IF EXISTS "admin_read_all_tokens" ON public.tokens;
CREATE POLICY "admin_read_all_tokens"
  ON public.tokens FOR SELECT
  TO authenticated
  USING (
    public.current_member_role() IN ('board', 'technician')
  );
