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
