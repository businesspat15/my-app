-- schema.sql
-- Users table used by frontend/api.saveUser and api.getUser
create table if not exists public.users (
  id text primary key,
  username text not null,
  coins bigint default 0 not null,
  businesses jsonb default '{}'::jsonb not null,
  level integer default 1 not null,
  last_mine bigint default 0 not null,
  referred_by text,
  referrals_count integer default 0 not null,
  subscribed boolean default false not null,
  language_code text default 'en' not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Upsert trigger to keep updated_at accurate (optional)
create or replace function public.update_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before insert or update on public.users
  for each row execute function public.update_timestamp();


create or replace function public.handle_referral(
  p_new_user_id text,
  p_new_username text,
  p_referred_by text
)
returns void language plpgsql as $$
declare
  v_referrer_id text;
begin
  insert into public.users(id, username, coins, businesses, level, last_mine, referred_by, referrals_count, subscribed, language_code)
  values (p_new_user_id, p_new_username, 0, '{}'::jsonb, 1, 0, p_referred_by, 0, false, 'en')
  on conflict (id) do update set username = excluded.username;

  if p_referred_by is not null and p_referred_by <> '' then
    v_referrer_id := regexp_replace(p_referred_by, '^ref_', '');
    update public.users set referrals_count = referrals_count + 1, coins = coins + 100 where id = v_referrer_id;
    update public.users set coins = coins + 50 where id = p_new_user_id;
  end if;
end;
$$;

