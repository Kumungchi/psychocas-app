-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create branches table
create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text,
  created_at timestamptz default now()
);

-- Create memberships table (replaces legacy members table)
create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  first_name text,
  last_name text,
  full_name text,
  phone text,
  branch_id uuid references public.branches(id),
  role text not null check (role in ('member','manager','council','technician','admin')) default 'member',
  membership_active boolean not null default false,
  membership_expires date,
  approved boolean default false,
  approved_at timestamptz,
  approved_by uuid references public.memberships(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create membership whitelist table for onboarding
create table if not exists public.membership_whitelist (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  first_name text,
  last_name text,
  phone text,
  role text not null check (role in ('member','manager','council','technician','admin')) default 'member',
  branch_id uuid references public.branches(id),
  note text,
  invited_by uuid references public.memberships(user_id),
  invited_at timestamptz default now(),
  consumed_at timestamptz,
  consumed_by uuid references public.memberships(user_id),
  active boolean default true
);

-- Create partner offers table for national and local discounts
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
  created_by uuid references public.memberships(user_id) on delete set null,
  updated_by uuid references public.memberships(user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create tokens table
create table if not exists public.tokens (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  user_id uuid not null references public.memberships(user_id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- Create redemptions table
create table if not exists public.redemptions (
  id uuid primary key default uuid_generate_v4(),
  token_id uuid references public.tokens(id) on delete set null,
  branch_id uuid references public.branches(id),
  redeemed_at timestamptz not null default now()
);