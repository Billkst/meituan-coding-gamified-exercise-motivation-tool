-- 20260510000018_day11_friendships.sql
-- Day 11: friendships (double-row model) + 5 mutation RPCs + list_friends.
-- Also enhances handle_new_user() to seed each new account with one active
-- friend and one incoming invitation from random demo users — so the reviewer
-- opens /friends and immediately has someone to interact with.

-- ============================================================
-- SECTION 1: friendships table
-- ============================================================
create table if not exists public.friendships (
  user_id    uuid not null references public.users(id) on delete cascade,
  friend_id  uuid not null references public.users(id) on delete cascade,
  status     text not null default 'pending'
    check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx
  on public.friendships (friend_id, status);

-- ============================================================
-- SECTION 2: RLS — select rows touching self; mutations via RPC only
-- ============================================================
alter table public.friendships enable row level security;

create policy "friendships_select_self"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

revoke insert, update, delete on public.friendships from authenticated, anon;

-- ============================================================
-- SECTION 3: send_friend_request
-- ============================================================
create or replace function public.send_friend_request(p_to uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_existing record;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;
  if p_to is null or p_to = v_user_id then
    raise exception 'invalid target user' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_to) then
    raise exception 'target user not found' using errcode = '22023';
  end if;

  -- block if any direction already exists
  select * into v_existing from public.friendships
    where (user_id = v_user_id and friend_id = p_to)
       or (user_id = p_to and friend_id = v_user_id)
    limit 1;
  if found then
    raise exception 'relation already exists: %', v_existing.status using errcode = '23505';
  end if;

  insert into public.friendships (user_id, friend_id, status)
    values (v_user_id, p_to, 'pending');
end; $$;

grant execute on function public.send_friend_request(uuid) to authenticated;

-- ============================================================
-- SECTION 4: accept_friend_request
-- ============================================================
create or replace function public.accept_friend_request(p_from uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  update public.friendships
    set status = 'active'
    where user_id = p_from and friend_id = v_user_id and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no pending invitation from this user' using errcode = '22023';
  end if;

  insert into public.friendships (user_id, friend_id, status)
    values (v_user_id, p_from, 'active')
    on conflict (user_id, friend_id) do update set status = 'active';
end; $$;

grant execute on function public.accept_friend_request(uuid) to authenticated;

-- ============================================================
-- SECTION 5: decline_friend_request
-- ============================================================
create or replace function public.decline_friend_request(p_from uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;
  delete from public.friendships
    where user_id = p_from and friend_id = v_user_id and status = 'pending';
end; $$;

grant execute on function public.decline_friend_request(uuid) to authenticated;

-- ============================================================
-- SECTION 6: cancel_friend_request (sender withdraws)
-- ============================================================
create or replace function public.cancel_friend_request(p_to uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;
  delete from public.friendships
    where user_id = v_user_id and friend_id = p_to and status = 'pending';
end; $$;

grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- ============================================================
-- SECTION 7: unfriend (remove both sides of an active friendship)
-- ============================================================
create or replace function public.unfriend(p_friend uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;
  delete from public.friendships
    where (user_id = v_user_id and friend_id = p_friend)
       or (user_id = p_friend and friend_id = v_user_id);
end; $$;

grant execute on function public.unfriend(uuid) to authenticated;

-- ============================================================
-- SECTION 8: list_friends — returns jsonb {active, incoming, outgoing}
-- ============================================================
create or replace function public.list_friends()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_user_id uuid := auth.uid();
  v_active   jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',           u.id,
    'username',          u.username,
    'level',             u.level,
    'season_score',      u.season_score,
    'current_streak',    u.current_streak,
    'last_workout_date', u.last_workout_date
  ) order by u.season_score desc, u.username), '[]'::jsonb)
  into v_active
  from public.friendships f
    join public.users u on u.id = f.friend_id
  where f.user_id = v_user_id and f.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',      u.id,
    'username',     u.username,
    'level',        u.level,
    'season_score', u.season_score
  ) order by f.created_at desc), '[]'::jsonb)
  into v_incoming
  from public.friendships f
    join public.users u on u.id = f.user_id
  where f.friend_id = v_user_id and f.status = 'pending';

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',      u.id,
    'username',     u.username,
    'level',        u.level,
    'season_score', u.season_score
  ) order by f.created_at desc), '[]'::jsonb)
  into v_outgoing
  from public.friendships f
    join public.users u on u.id = f.friend_id
  where f.user_id = v_user_id and f.status = 'pending';

  return jsonb_build_object(
    'active',   v_active,
    'incoming', v_incoming,
    'outgoing', v_outgoing
  );
end; $$;

grant execute on function public.list_friends() to authenticated;

-- ============================================================
-- SECTION 9: handle_new_user enhancement
-- Seed each new account with 1 active friend + 1 incoming pending invitation
-- from random demo users. Demo users have id pattern 0000000_-...
-- on conflict do nothing keeps it idempotent if trigger fires twice.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_username text;
  v_demo_active uuid;
  v_demo_pending uuid;
begin
  random_username := 'user_' || substr(new.id::text, 1, 8);
  insert into public.users (id, username)
    values (new.id, random_username);
  insert into public.decks (user_id, name, card_ids, is_active)
    values (new.id, '主卡组', '{}', true);

  -- Pick two distinct demo users at random for the social-loop seed.
  select id into v_demo_active
    from public.users
    where id::text like '0000000_-000_-400_-800_-%' and id <> new.id
    order by random()
    limit 1;
  select id into v_demo_pending
    from public.users
    where id::text like '0000000_-000_-400_-800_-%' and id <> new.id and id <> v_demo_active
    order by random()
    limit 1;

  if v_demo_active is not null then
    -- Active double-row friendship between new user and demo
    insert into public.friendships (user_id, friend_id, status)
      values (new.id, v_demo_active, 'active'),
             (v_demo_active, new.id, 'active')
      on conflict (user_id, friend_id) do nothing;
  end if;
  if v_demo_pending is not null then
    -- Demo sent the new user an invite — incoming pending row
    insert into public.friendships (user_id, friend_id, status)
      values (v_demo_pending, new.id, 'pending')
      on conflict (user_id, friend_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
-- Trigger already exists from schema migration; no need to recreate it.
