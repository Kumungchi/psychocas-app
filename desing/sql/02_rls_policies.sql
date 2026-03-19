-- =============================================================================
-- PSYCHOČAS — ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- RLS is Supabase's way of controlling WHO can read/write WHICH rows.
-- Every query from the browser goes through these rules automatically.
--
-- Without RLS, anyone with the anon key could read/modify any row.
-- With RLS, the database itself enforces access control.
--
-- HOW IT WORKS:
--   1. `auth.uid()` returns the logged-in user's Supabase Auth ID
--   2. We look up their `members` row to get their `role` and `branch_id`
--   3. Policies use these to decide what they can see/do
--
-- ROLE HIERARCHY:
--   member     → can read own data + browse public discounts
--   manager    → + manage local discounts/partners, see branch stats
--   board      → + see all branches, manage national discounts (admin)
--   technician → same as board + full system access (super-admin)
--
-- In policies we use IN ('board', 'technician') for admin-level access.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ENABLE RLS ON ALL TABLES
-- (Without this, policies have no effect)
-- -----------------------------------------------------------------------------

ALTER TABLE public.branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions      ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- BRANCHES — everyone can read
-- =============================================================================
-- Branches are public info (used in dropdowns, discount filtering).
-- Only admins can create/modify branches (via Supabase dashboard for now).

CREATE POLICY "anyone_read_branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (true);


-- =============================================================================
-- MEMBER_WHITELIST — managers see their branch, admins see all
-- =============================================================================
-- The whitelist is sensitive (contains emails).
-- Members don't need to see it — the app checks it server-side during login.

CREATE POLICY "manager_read_branch_whitelist"
  ON public.member_whitelist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = member_whitelist.branch_id
    )
  );

CREATE POLICY "admin_read_all_whitelist"
  ON public.member_whitelist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );

-- Admins can add/update whitelist entries (manage members)
CREATE POLICY "admin_manage_whitelist"
  ON public.member_whitelist FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );

-- Manager can add whitelist entries for their own branch
CREATE POLICY "manager_insert_branch_whitelist"
  ON public.member_whitelist FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = member_whitelist.branch_id
    )
  );


-- =============================================================================
-- MEMBERS — read own profile, managers see branch, admins see all
-- =============================================================================

-- Everyone can read their own profile
CREATE POLICY "member_read_self"
  ON public.members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can see members in their branch
CREATE POLICY "manager_read_branch_members"
  ON public.members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = members.branch_id
    )
  );

-- Admins can see all members
CREATE POLICY "admin_read_all_members"
  ON public.members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );

-- Members can insert their own profile (first login — AuthContext creates it)
CREATE POLICY "member_insert_self"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role can also insert (for admin operations)
CREATE POLICY "service_insert_members"
  ON public.members FOR INSERT
  TO service_role
  WITH CHECK (true);


-- =============================================================================
-- PARTNERS — all members can read active, managers/admins can manage
-- =============================================================================

-- All authenticated users can see active partners
-- National partners (branch_id IS NULL) → everyone sees them
-- Local partners → only members of that branch (or managers/admins)
CREATE POLICY "member_read_active_partners"
  ON public.partners FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      branch_id IS NULL  -- national → everyone
      OR EXISTS (
        SELECT 1 FROM public.members me
        WHERE me.user_id = auth.uid()
          AND (
            me.role IN ('manager', 'board', 'technician')  -- managers/admins see all
            OR me.branch_id = partners.branch_id            -- members see their branch
          )
      )
    )
  );

-- Managers can manage local partners in their branch
CREATE POLICY "manager_manage_local_partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (
    partners.branch_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = partners.branch_id
    )
  )
  WITH CHECK (
    partners.branch_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = partners.branch_id
    )
  );

-- Admins can manage all partners (national + any branch)
CREATE POLICY "admin_manage_all_partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );


-- =============================================================================
-- DISCOUNTS — same visibility as partners, managers/admins can manage
-- =============================================================================

-- Members can read active discounts where the partner is also active
CREATE POLICY "member_read_active_discounts"
  ON public.discounts FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = discounts.partner_id
        AND p.is_active = true
        AND (
          p.branch_id IS NULL  -- national
          OR EXISTS (
            SELECT 1 FROM public.members me
            WHERE me.user_id = auth.uid()
              AND (
                me.role IN ('manager', 'board', 'technician')
                OR me.branch_id = p.branch_id
              )
          )
        )
    )
  );

-- Managers can manage discounts for local partners in their branch
CREATE POLICY "manager_manage_local_discounts"
  ON public.discounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      JOIN public.members me ON me.user_id = auth.uid()
      WHERE p.id = discounts.partner_id
        AND p.branch_id IS NOT NULL
        AND me.role = 'manager'
        AND me.branch_id = p.branch_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partners p
      JOIN public.members me ON me.user_id = auth.uid()
      WHERE p.id = discounts.partner_id
        AND p.branch_id IS NOT NULL
        AND me.role = 'manager'
        AND me.branch_id = p.branch_id
    )
  );

-- Admins can manage all discounts
CREATE POLICY "admin_manage_all_discounts"
  ON public.discounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );


-- =============================================================================
-- TOKENS — members manage their own, service role for validation
-- =============================================================================

-- Members can read their own tokens
CREATE POLICY "member_read_own_tokens"
  ON public.tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.id = tokens.member_id
    )
  );

-- Members can create tokens for themselves
CREATE POLICY "member_insert_own_tokens"
  ON public.tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.id = tokens.member_id
    )
  );

-- Service role can read/update any token (for Edge Functions: validation + redemption)
CREATE POLICY "service_manage_tokens"
  ON public.tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- REDEMPTIONS — managers see branch, admins see all
-- =============================================================================
-- Redemptions are created by Edge Functions (service_role), not by users directly.

-- Managers can read redemptions for their branch
CREATE POLICY "manager_read_branch_redemptions"
  ON public.redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = redemptions.branch_id
    )
  );

-- Admins can read all redemptions
CREATE POLICY "admin_read_all_redemptions"
  ON public.redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );

-- Only service_role can insert redemptions (Edge Function redeem_token)
CREATE POLICY "service_insert_redemptions"
  ON public.redemptions FOR INSERT
  TO service_role
  WITH CHECK (true);


-- =============================================================================
-- GRANTS
-- =============================================================================
-- Supabase uses Postgres roles: anon (not logged in), authenticated (logged in),
-- service_role (server-side, bypasses RLS).
-- We grant table access to these roles — RLS policies then filter the rows.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.branches TO anon, authenticated;

GRANT SELECT, INSERT         ON public.member_whitelist TO authenticated;
GRANT ALL    ON public.member_whitelist TO service_role;

GRANT SELECT, INSERT         ON public.members TO authenticated;
GRANT ALL    ON public.members TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.partners TO authenticated;
GRANT ALL    ON public.partners TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.discounts TO authenticated;
GRANT ALL    ON public.discounts TO service_role;

GRANT SELECT, INSERT         ON public.tokens TO authenticated;
GRANT ALL    ON public.tokens TO service_role;

GRANT SELECT                 ON public.redemptions TO authenticated;
GRANT ALL    ON public.redemptions TO service_role;
