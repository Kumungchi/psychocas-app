-- =============================================================
-- QA MEMBER + INVITE SEEDING FOR THE NEW DATA MODEL
-- =============================================================
-- This helper script keeps the demo accounts in sync with the
-- profiles/memberships/invites schema. It upserts the invite
-- whitelist and ensures matching membership rows exist when the
-- Supabase auth user has already been created locally.
-- =============================================================

-- Seed invite directory -----------------------------------------
insert into public.invites (email, first_name, last_name, role, branch_id, status, notes)
values
  ('bunnik.matias@seznam.cz', 'Matias', 'Bunnik', 'member', '550e8400-e29b-41d4-a716-446655440000', 'active', 'QA member account'),
  ('member.tester@psychocas.test', 'Test', 'Člen', 'member', '550e8400-e29b-41d4-a716-446655440000', 'active', 'Demo invite for regression tests'),
  ('manager@psychocas.cz', 'Manažer', 'Pobočky', 'manager', '550e8400-e29b-41d4-a716-446655440000', 'active', 'Local manager preview'),
  ('tajemnik@psychocas.cz', 'Tajemník', 'Psychočas', 'council', null, 'active', 'Council access for dashboards'),
  ('viceprezident@psychocas.cz', 'Viceprezident', 'Psychočas', 'council', null, 'active', 'Council access for dashboards'),
  ('prezident@psychocas.cz', 'Prezident', 'Psychočas', 'council', null, 'active', 'Council access for dashboards'),
  ('technik@psychocas.cz', 'Technik', 'Psychočas', 'technician', null, 'active', 'Technician tooling preview')
on conflict (email) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  branch_id = excluded.branch_id,
  status = excluded.status,
  notes = excluded.notes,
  added_at = now();

-- Ensure matching memberships ----------------------------------
do $$
declare
  target record;
  profile_id uuid;
begin
  for target in (
    select * from (
      values
        ('bunnik.matias@seznam.cz', 'member', '550e8400-e29b-41d4-a716-446655440000'::uuid),
        ('member.tester@psychocas.test', 'member', '550e8400-e29b-41d4-a716-446655440000'::uuid),
        ('manager@psychocas.cz', 'manager', '550e8400-e29b-41d4-a716-446655440000'::uuid),
        ('tajemnik@psychocas.cz', 'council', null::uuid),
        ('viceprezident@psychocas.cz', 'council', null::uuid),
        ('prezident@psychocas.cz', 'council', null::uuid),
        ('technik@psychocas.cz', 'technician', null::uuid)
    ) as t(email, role, branch_id)
  ) loop
    select id into profile_id from public.profiles where lower(email) = lower(target.email);

    if profile_id is null then
      raise notice 'ℹ️ Auth profile for % not found – invite will activate on first login.', target.email;
      continue;
    end if;

    insert into public.memberships (user_id, role, branch_id, status, membership_active, membership_expires, approved_at)
    values (
      profile_id,
      target.role,
      target.branch_id,
      'active',
      true,
      (current_date + interval '1 year')::date,
      now()
    )
    on conflict (user_id) do update set
      role = excluded.role,
      branch_id = excluded.branch_id,
      status = excluded.status,
      membership_active = excluded.membership_active,
      membership_expires = excluded.membership_expires,
      approved_at = excluded.approved_at,
      updated_at = now();

    raise notice '✅ Membership prepared for %', target.email;
  end loop;
end;
$$;
