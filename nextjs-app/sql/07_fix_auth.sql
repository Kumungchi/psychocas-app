-- ========================================
-- AUTH FIX (DEPRECATED LEGACY SCRIPT)
-- ========================================
-- The original version of this file recreated the `members`
-- trigger used by the pre-invite data model. The application now
-- relies on `profiles`, `memberships`, and `invites`, with the
-- canonical trigger living in `08_trusted_users.sql`.
--
-- Keep this file as a gentle reminder for teams following older
-- documentation. Executing it will simply surface a notice that
-- points to the new helper.
-- ========================================

do $$
begin
  raise notice 'ℹ️ The auth trigger is now defined in sql/08_trusted_users.sql (profiles + memberships + invites).';
  raise notice '   Run that script to install or refresh the handle_new_user trigger.';
end;
$$;
