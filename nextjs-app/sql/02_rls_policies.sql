-- Enable Row Level Security
alter table public.members enable row level security;
alter table public.tokens enable row level security;
alter table public.redemptions enable row level security;
alter table public.branches enable row level security;

-- Member policies
create policy "member_read_self" on public.members
for select using (auth.uid() = user_id);

create policy "technician_read_all_members" on public.members
for select using (exists (
  select 1 from public.members me where me.user_id=auth.uid() and me.role='technician'
));

create policy "manager_read_branch_members" on public.members
for select using (exists (
  select 1 from public.members me
  where me.user_id=auth.uid() and me.role='manager' and me.branch_id=members.branch_id
));

-- Token policies
create policy "member_read_own_tokens" on public.tokens
for select using (user_id = auth.uid());

create policy "member_insert_own_tokens" on public.tokens
for insert with check (user_id = auth.uid());

create policy "manager_read_branch_tokens" on public.tokens
for select using (exists (
  select 1 from public.members me
  join public.members owner on owner.user_id = tokens.user_id
  where me.user_id = auth.uid() and me.role='manager' and me.branch_id=owner.branch_id
));

-- Redemption policies
create policy "manager_read_branch_redemptions" on public.redemptions
for select using (exists (
  select 1 from public.members me
  where me.user_id=auth.uid() and me.role='manager' and me.branch_id=redemptions.branch_id
));

create policy "council_read_all_redemptions" on public.redemptions
for select using (exists (
  select 1 from public.members me where me.user_id=auth.uid() and me.role='council'
));

-- Insert redemptions only from server-side function
create policy "redemptions_insert_server_only" on public.redemptions
for insert with check (false);