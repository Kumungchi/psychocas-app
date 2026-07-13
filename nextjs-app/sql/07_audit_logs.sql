-- =============================================================================
-- PSYCHOČAS — AUDIT LOGS FOR MANAGEMENT ACTIONS
-- =============================================================================
-- Tracks admin/manager changes on partners and discounts directly in DB.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id    uuid,
  actor_member_id  uuid        REFERENCES public.members(id),
  action           text        NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'activate', 'deactivate')),
  entity_type      text        NOT NULL CHECK (entity_type IN ('partner', 'discount')),
  entity_id        uuid        NOT NULL,
  entity_name      text,
  entity_branch_id uuid        REFERENCES public.branches(id),
  before_data      jsonb,
  after_data       jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON public.admin_audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_branch
  ON public.admin_audit_logs (entity_branch_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_management_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid;
  v_actor_member_id uuid;
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_entity_name text;
  v_entity_branch_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NOT NULL THEN
    SELECT id INTO v_actor_member_id
    FROM public.members
    WHERE user_id = v_actor_user_id
    LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_action := 'insert';
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);

    IF OLD.is_active = true AND NEW.is_active = false THEN
      v_action := 'deactivate';
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      v_action := 'activate';
    ELSE
      v_action := 'update';
    END IF;
  ELSE
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_action := 'delete';
  END IF;

  IF TG_TABLE_NAME = 'partners' THEN
    v_entity_type := 'partner';
    v_entity_id := COALESCE(NEW.id, OLD.id);
    v_entity_name := COALESCE(NEW.name, OLD.name);
    v_entity_branch_id := COALESCE(NEW.branch_id, OLD.branch_id);
  ELSIF TG_TABLE_NAME = 'discounts' THEN
    v_entity_type := 'discount';
    v_entity_id := COALESCE(NEW.id, OLD.id);
    v_entity_name := COALESCE(NEW.title, OLD.title);

    SELECT p.branch_id INTO v_entity_branch_id
    FROM public.partners p
    WHERE p.id = COALESCE(NEW.partner_id, OLD.partner_id)
    LIMIT 1;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    actor_member_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    entity_branch_id,
    before_data,
    after_data
  ) VALUES (
    v_actor_user_id,
    v_actor_member_id,
    v_action,
    v_entity_type,
    v_entity_id,
    v_entity_name,
    v_entity_branch_id,
    v_before,
    v_after
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_partners ON public.partners;
CREATE TRIGGER trg_audit_partners
  AFTER INSERT OR UPDATE OR DELETE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_management_changes();

DROP TRIGGER IF EXISTS trg_audit_discounts ON public.discounts;
CREATE TRIGGER trg_audit_discounts
  AFTER INSERT OR UPDATE OR DELETE ON public.discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_management_changes();

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_read_branch_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "manager_read_branch_audit_logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.members me
      WHERE me.user_id = auth.uid()
        AND (
          me.role IN ('board', 'technician')
          OR (
            me.role = 'manager'
            AND (admin_audit_logs.entity_branch_id = me.branch_id OR admin_audit_logs.entity_branch_id IS NULL)
          )
        )
    )
  );

DROP POLICY IF EXISTS "service_manage_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "service_manage_audit_logs"
  ON public.admin_audit_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
