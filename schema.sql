-- ===========================================================
--  USERS TABLE
-- ===========================================================
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

-- ===========================================================
--  TIMESTAMP TRIGGER
-- ===========================================================

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


-- ===========================================================
--  DROP OLD REFERRAL FUNCTION (IMPORTANT)
-- ===========================================================

drop function if exists public.handle_referral(text, text, text);


-- ===========================================================
--  NEW REFERRAL FUNCTION (ATOMIC)
-- ===========================================================

create or replace function public.handle_referral(
  p_new_user_id text,
  p_new_username text,
  p_referred_by text
)
returns jsonb language plpgsql as $$
declare
  v_referrer_id text;
  v_new_user record;
  v_referrer record;
begin
  -- Normalize referrer param (remove 'ref_' prefix)
  if p_referred_by is not null and p_referred_by <> '' then
    v_referrer_id := regexp_replace(p_referred_by, '^ref_', '');
  else
    v_referrer_id := null;
  end if;

  -- Create or update new user
  insert into public.users(id, username, coins, businesses, level, last_mine, referred_by, referrals_count, subscribed, language_code)
  values (p_new_user_id, p_new_username, 0, '{}'::jsonb, 1, 0, null, 0, false, 'en')
  on conflict(id) do update
    set username = coalesce(excluded.username, public.users.username)
  returning * into v_new_user;

  -- If no referral, return only user
  if v_referrer_id is null or v_referrer_id = p_new_user_id then
    return jsonb_build_object('new_user', to_jsonb(v_new_user));
  end if;

  -- If already referred before, do not process again
  if (select referred_by from public.users where id = p_new_user_id) is not null then
    return jsonb_build_object(
      'new_user',
      to_jsonb((select * from public.users where id = p_new_user_id))
    );
  end if;

  -- Try to get referrer
  select * into v_referrer from public.users where id = v_referrer_id;
  if not found then
    return jsonb_build_object('new_user', to_jsonb(v_new_user));
  end if;

  -- Set referral
  update public.users
    set referred_by = v_referrer_id
    where id = p_new_user_id;

  -- Reward referrer
  update public.users
    set referrals_count = referrals_count + 1,
        coins = coins + 100
    where id = v_referrer_id;

  -- Reward new user
  update public.users
    set coins = coins + 50
    where id = p_new_user_id;

  -- Return both updated users
  return jsonb_build_object(
    'new_user', (select to_jsonb(u) from public.users u where u.id = p_new_user_id),
    'referrer', (select to_jsonb(u) from public.users u where u.id = v_referrer_id)
  );
end;
$$;
