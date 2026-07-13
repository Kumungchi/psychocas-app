-- =============================================================================
-- PSYCHOČAS — TOKEN READ POLICIES FOR ANALYTICS
-- =============================================================================
-- Allows manager/board/technician to read tokens for statistics.
-- =============================================================================

DROP POLICY IF EXISTS "manager_read_branch_tokens" ON public.tokens;
CREATE POLICY "manager_read_branch_tokens"
  ON public.tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.members me
      JOIN public.members owner ON owner.id = tokens.member_id
      WHERE me.user_id = auth.uid()
        AND me.role = 'manager'
        AND me.branch_id = owner.branch_id
    )
  );

DROP POLICY IF EXISTS "admin_read_all_tokens" ON public.tokens;
CREATE POLICY "admin_read_all_tokens"
  ON public.tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.members me
      WHERE me.user_id = auth.uid()
        AND me.role IN ('board', 'technician')
    )
  );
