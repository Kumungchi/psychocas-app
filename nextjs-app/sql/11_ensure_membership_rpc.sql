-- RPC: ensure_membership_from_whitelist
-- Called on login to auto-create a members row from the whitelist if needed.
-- Returns the member's status, role, branch_id, and id.
CREATE OR REPLACE FUNCTION ensure_membership_from_whitelist()
RETURNS TABLE(status TEXT, role TEXT, branch_id UUID, id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_whitelist RECORD;
  v_member RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 'error'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE auth.users.id = v_user_id;

  -- Check if member already exists
  SELECT m.id, m.role, m.branch_id INTO v_member
  FROM members m WHERE m.user_id = v_user_id LIMIT 1;

  IF v_member.id IS NOT NULL THEN
    RETURN QUERY SELECT 'existing'::TEXT, v_member.role, v_member.branch_id, v_member.id;
    RETURN;
  END IF;

  -- Look up whitelist
  SELECT w.id, w.full_name, w.email, w.branch_id, w.is_active
  INTO v_whitelist
  FROM member_whitelist w
  WHERE w.email = v_user_email AND w.is_active = TRUE
  LIMIT 1;

  IF v_whitelist.id IS NULL THEN
    RETURN QUERY SELECT 'not_whitelisted'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Create member from whitelist
  INSERT INTO members (user_id, whitelist_id, full_name, email, branch_id, role)
  VALUES (v_user_id, v_whitelist.id, v_whitelist.full_name, v_whitelist.email, v_whitelist.branch_id, 'member')
  RETURNING members.id, members.role, members.branch_id INTO v_member;

  RETURN QUERY SELECT 'created'::TEXT, v_member.role, v_member.branch_id, v_member.id;
END;
$$;
