-- Enable Row Level Security
alter table public.members enable row level security;
alter table public.tokens enable row level security;
alter table public.redemptions enable row level security;
alter table public.branches enable row level security;
alter table public.partner_offers enable row level security;

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

-- Partner offers policies
create policy "members_read_partner_offers" on public.partner_offers
for select using (
  partner_offers.active = true
  and (
    partner_offers.scope = 'national'
    or exists (
      select 1 from public.members me
      where me.user_id = auth.uid()
        and (
          me.role in ('manager','council','technician')
          or me.branch_id = partner_offers.branch_id
        )
    )
  )
);

create policy "council_manage_partner_offers" on public.partner_offers
for all using (exists (
  select 1 from public.members me
  where me.user_id = auth.uid()
    and me.role in ('council','technician')
))
with check (exists (
  select 1 from public.members me
  where me.user_id = auth.uid()
    and me.role in ('council','technician')
));

create policy "managers_manage_branch_partner_offers" on public.partner_offers
for all using (exists (
  select 1 from public.members me
  where me.user_id = auth.uid()
    and me.role = 'manager'
    and me.email like '%@psychocas.cz'
    and partner_offers.scope = 'local'
    and partner_offers.branch_id = me.branch_id
))
with check (exists (
  select 1 from public.members me
  where me.user_id = auth.uid()
    and me.role = 'manager'
    and me.email like '%@psychocas.cz'
    and partner_offers.scope = 'local'
    and partner_offers.branch_id = me.branch_id
));