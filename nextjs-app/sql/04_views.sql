-- Daily view for stats
create or replace view public.redemptions_daily as
select branch_id, date_trunc('day', redeemed_at)::date as day, count(*) as total
from public.redemptions
group by 1,2;