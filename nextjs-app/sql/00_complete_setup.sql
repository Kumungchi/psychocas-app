-- ========================================
-- COMPLETE DATABASE SETUP SCRIPT (v2)
-- ========================================
-- This consolidated script provisions the
-- Psychočas data model built on profiles,
-- memberships, and invites.
-- ========================================

-- 1) Extensions -------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists citext;

-- 2) Enum types -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type membership_status as enum ('pending', 'active', 'suspended', 'revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type invite_status as enum ('pending', 'active', 'revoked', 'expired');
  end if;
end;
$$;

-- 3) Tables -----------------------------------------------------
create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id),
  role text not null check (role in ('member','manager','council','technician')) default 'member',
  status membership_status not null default 'pending',
  membership_active boolean not null default false,
  membership_expires date,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

create table if not exists public.invites (
  id uuid primary key default uuid_generate_v4(),
  email citext not null unique,
  first_name text,
  last_name text,
  phone text,
  role text not null check (role in ('member','manager','council','technician')) default 'member',
  branch_id uuid references public.branches(id),
  status invite_status not null default 'pending',
  expires_at timestamptz,
  notes text,
  invited_by uuid references auth.users(id),
  added_at timestamptz default now()
);

create index if not exists invites_email_lower_idx on public.invites (lower(email));

create table if not exists public.partner_offers (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  discount_code text,
  discount_percentage numeric(5,2),
  scope text not null check (scope in ('national','local')),
  branch_id uuid references public.branches(id),
  city text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tokens (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists public.redemptions (
  id uuid primary key default uuid_generate_v4(),
  token_id uuid references public.tokens(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete set null,
  branch_id uuid references public.branches(id),
  redeemed_at timestamptz not null default now()
);

-- 4) Row Level Security ----------------------------------------
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.tokens enable row level security;
alter table public.redemptions enable row level security;
alter table public.branches enable row level security;
alter table public.partner_offers enable row level security;

-- 5) Policies ---------------------------------------------------
create policy if not exists "profiles_read_self" on public.profiles
for select using (auth.uid() = id);

create policy if not exists "profiles_update_self" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy if not exists "memberships_read_self" on public.memberships
for select using (auth.uid() = user_id);

create policy if not exists "technician_read_all_memberships" on public.memberships
for select using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role = 'technician'
  )
);

create policy if not exists "manager_read_branch_memberships" on public.memberships
for select using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role = 'manager'
      and me.branch_id = memberships.branch_id
  )
);

create policy if not exists "council_manage_memberships" on public.memberships
for all using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('council','technician')
  )
)
with check (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('council','technician')
  )
);

create policy if not exists "staff_manage_invites" on public.invites
for all using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('manager','council','technician')
  )
)
with check (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('manager','council','technician')
  )
);

create policy if not exists "member_read_own_tokens" on public.tokens
for select using (user_id = auth.uid());

create policy if not exists "member_insert_own_tokens" on public.tokens
for insert with check (user_id = auth.uid());

create policy if not exists "manager_read_branch_tokens" on public.tokens
for select using (
  exists (
    select 1 from public.memberships me
    join public.memberships owner on owner.id = tokens.membership_id
    where me.user_id = auth.uid()
      and me.role = 'manager'
      and me.branch_id = owner.branch_id
  )
);

create policy if not exists "manager_read_branch_redemptions" on public.redemptions
for select using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role = 'manager'
      and me.branch_id = redemptions.branch_id
  )
);

create policy if not exists "council_read_all_redemptions" on public.redemptions
for select using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('council','technician')
  )
);

create policy if not exists "redemptions_insert_server_only" on public.redemptions
for insert with check (false);

create policy if not exists "members_read_partner_offers" on public.partner_offers
for select using (
  partner_offers.active = true
  and (
    partner_offers.scope = 'national'
    or exists (
      select 1 from public.memberships me
      where me.user_id = auth.uid()
        and (
          me.role in ('manager','council','technician')
          or me.branch_id = partner_offers.branch_id
        )
    )
  )
);

create policy if not exists "council_manage_partner_offers" on public.partner_offers
for all using (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('council','technician')
  )
)
with check (
  exists (
    select 1 from public.memberships me
    where me.user_id = auth.uid()
      and me.role in ('council','technician')
  )
);

create policy if not exists "managers_manage_branch_partner_offers" on public.partner_offers
for all using (
  exists (
    select 1 from public.memberships me
    join public.profiles p on p.id = me.user_id
    where me.user_id = auth.uid()
      and me.role = 'manager'
      and p.email ilike '%@psychocas.cz'
      and partner_offers.scope = 'local'
      and partner_offers.branch_id = me.branch_id
  )
)
with check (
  exists (
    select 1 from public.memberships me
    join public.profiles p on p.id = me.user_id
    where me.user_id = auth.uid()
      and me.role = 'manager'
      and p.email ilike '%@psychocas.cz'
      and partner_offers.scope = 'local'
      and partner_offers.branch_id = me.branch_id
  )
);

-- 6) Triggers ---------------------------------------------------
create or replace function public.prevent_token_spam()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.tokens
    where user_id = new.user_id
      and consumed_at is null
      and expires_at > now()
  ) then
    raise exception 'Active token already exists';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_token_spam on public.tokens;
create trigger trg_token_spam
before insert on public.tokens
for each row execute function public.prevent_token_spam();

-- 7) Auth bridge ------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  invite_record record;
  resolved_role text := 'member';
  resolved_branch uuid := null;
  resolved_status membership_status := 'pending';
  resolved_active boolean := false;
  resolved_expires date := null;
  resolved_full_name text := null;
  resolved_phone text := null;
begin
  select *
    into invite_record
    from public.invites
    where lower(email) = lower(new.email)
    order by added_at desc
    limit 1;

  if invite_record is not null then
    resolved_role := invite_record.role;
    resolved_branch := invite_record.branch_id;
    resolved_full_name := concat_ws(' ', invite_record.first_name, invite_record.last_name);
    resolved_phone := invite_record.phone;
    if invite_record.status = 'active' then
      resolved_status := 'active';
      resolved_active := true;
      if invite_record.expires_at is not null then
        resolved_expires := invite_record.expires_at::date;
      end if;
    end if;
  elsif new.email ilike '%@psychocas.cz' then
    resolved_role := 'manager';
    resolved_status := 'active';
    resolved_active := true;
  end if;

  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, nullif(resolved_full_name, ''), resolved_phone)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();

  insert into public.memberships (
    user_id,
    branch_id,
    role,
    status,
    membership_active,
    membership_expires,
    approved_at
  )
  values (
    new.id,
    resolved_branch,
    resolved_role,
    resolved_status,
    resolved_active,
    resolved_expires,
    case when resolved_active then now() else null end
  )
  on conflict (user_id) do update set
    branch_id = coalesce(excluded.branch_id, public.memberships.branch_id),
    role = excluded.role,
    status = excluded.status,
    membership_active = excluded.membership_active,
    membership_expires = coalesce(excluded.membership_expires, public.memberships.membership_expires),
    approved_at = coalesce(excluded.approved_at, public.memberships.approved_at),
    updated_at = now();

  return new;
exception
  when others then
    raise warning 'Error in handle_new_user trigger: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists handle_new_user on auth.users;
create trigger handle_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8) Helper procedure -------------------------------------------
create or replace function public.approve_member(
  member_user_id uuid,
  approver_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  approver_role text;
  target_email citext;
begin
  select role
    into approver_role
    from public.memberships
    where user_id = approver_user_id;

  if approver_role not in ('manager','council','technician') then
    raise exception 'Approver does not have permission';
  end if;

  update public.memberships
     set status = 'active',
         membership_active = true,
         approved_at = now(),
         membership_expires = coalesce(membership_expires, (current_date + interval '1 year')::date),
         updated_at = now()
   where user_id = member_user_id;

  if not found then
    return false;
  end if;

  select email into target_email from public.profiles where id = member_user_id;
  if target_email is not null then
    update public.invites
       set status = 'active'
     where lower(email) = lower(target_email)
       and status <> 'active';
  end if;

  return true;
end;
$$;

create or replace function public.ensure_membership()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email citext;
  invite_record public.invites%rowtype;
  resolved_role text := 'member';
  resolved_branch uuid := null;
  resolved_status membership_status := 'pending';
  resolved_active boolean := false;
  resolved_expires date := null;
  resolved_full_name text := null;
begin
  if current_user_id is null then
    return false;
  end if;

  select email
    into current_email
    from auth.users
   where id = current_user_id;

  if current_email is null then
    return false;
  end if;

  select *
    into invite_record
    from public.invites
   where lower(email) = lower(current_email)
   order by added_at desc
   limit 1;

  if invite_record is not null then
    resolved_role := invite_record.role;
    resolved_branch := invite_record.branch_id;
    resolved_full_name := concat_ws(' ', invite_record.first_name, invite_record.last_name);

    if invite_record.status = 'active' then
      resolved_status := 'active';
      resolved_active := true;
      if invite_record.expires_at is not null then
        resolved_expires := invite_record.expires_at::date;
      end if;
    elsif invite_record.status = 'revoked' then
      resolved_status := 'revoked';
      resolved_active := false;
    end if;
  elsif current_email::text ilike '%@psychocas.cz' then
    resolved_role := 'manager';
    resolved_status := 'active';
    resolved_active := true;
  end if;

  insert into public.profiles (id, email, full_name)
  values (current_user_id, current_email::text, nullif(resolved_full_name, ''))
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  insert into public.memberships (
    user_id,
    branch_id,
    role,
    status,
    membership_active,
    membership_expires,
    approved_at
  )
  values (
    current_user_id,
    resolved_branch,
    resolved_role,
    resolved_status,
    resolved_active,
    resolved_expires,
    case when resolved_active then now() else null end
  )
  on conflict (user_id) do update set
    branch_id = coalesce(excluded.branch_id, public.memberships.branch_id),
    role = excluded.role,
    status = excluded.status,
    membership_active = excluded.membership_active,
    membership_expires = coalesce(excluded.membership_expires, public.memberships.membership_expires),
    approved_at = coalesce(excluded.approved_at, public.memberships.approved_at),
    updated_at = now();

  return true;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.memberships to authenticated;
grant select, insert, update on public.invites to authenticated;
grant all on public.tokens to authenticated, service_role;
grant all on public.redemptions to authenticated, service_role;
grant all on public.partner_offers to authenticated, service_role;
grant all on public.branches to authenticated, service_role;

grant execute on function public.approve_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.ensure_membership() to authenticated, service_role;

do $$
begin
  raise notice '✅ Psychočas schema installed (profiles + memberships + invites).';
  raise notice '   Run sql/05_test_data.sql for demo content if needed.';
end;
$$;
