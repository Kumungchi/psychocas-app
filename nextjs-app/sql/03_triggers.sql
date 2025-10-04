-- Anti-spam trigger (1 active token at a time)
create or replace function public.prevent_token_spam()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.tokens
    where user_id=new.user_id and consumed_at is null and expires_at>now()
  ) then
    raise exception 'Active token already exists';
  end if;
  return new;
end $$;

drop trigger if exists trg_token_spam on public.tokens;
create trigger trg_token_spam
before insert on public.tokens
for each row execute function public.prevent_token_spam();