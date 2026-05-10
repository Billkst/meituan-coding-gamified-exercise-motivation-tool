-- 20260510000021_day11_pvp_fixes.sql
-- Day 11 hot-fixes uncovered during E2E smoke:
-- 1. start_pvp_battle's "8 cards" check failed open on empty array because
--    array_length('{}',1) returns NULL → NULL <> 8 is NULL → branch skipped.
--    Fix: coalesce(..,0).
-- 2. handle_new_user only created an empty active deck row, so the reviewer
--    finished onboarding with 3 cards (from grant_onboarding_pack) but no
--    deck loadout — PVP was unreachable. Fix: trigger now seeds 8 random
--    common+rare cards into user_cards AND assigns them to the active deck,
--    so the reviewer is PVP-ready out of the gate.

-- ============================================================
-- SECTION 1: start_pvp_battle — null-safe array_length check
-- ============================================================
create or replace function public.start_pvp_battle(p_opponent_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_my_deck text[];
  v_opp_deck text[];
  v_opp_user record;
  v_battle_id bigint;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;
  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception 'invalid opponent' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.friendships
      where user_id = v_user_id and friend_id = p_opponent_id and status = 'active'
  ) then
    raise exception 'opponent is not an active friend' using errcode = '22023';
  end if;

  select card_ids into v_my_deck
    from public.decks where user_id = v_user_id and is_active = true;
  if coalesce(array_length(v_my_deck, 1), 0) <> 8 then
    raise exception 'your active deck must have exactly 8 cards' using errcode = '22023';
  end if;

  select card_ids into v_opp_deck
    from public.decks where user_id = p_opponent_id and is_active = true;
  if coalesce(array_length(v_opp_deck, 1), 0) <> 8 then
    raise exception 'opponent has no 8-card deck yet' using errcode = '22023';
  end if;

  select id, username, level into v_opp_user
    from public.users where id = p_opponent_id;

  insert into battles (attacker_id, defender_id, npc_id, attacker_deck_ids, defender_deck_ids)
    values (v_user_id, p_opponent_id, null, v_my_deck, v_opp_deck)
    returning id into v_battle_id;

  return jsonb_build_object(
    'battle_id', v_battle_id,
    'attacker_deck_ids', to_jsonb(v_my_deck),
    'defender_deck_ids', to_jsonb(v_opp_deck),
    'opponent_user_id', v_opp_user.id,
    'opponent_username', v_opp_user.username,
    'opponent_level', v_opp_user.level,
    'kind', 'pvp'
  );
end; $$;

grant execute on function public.start_pvp_battle(uuid) to authenticated;

-- ============================================================
-- SECTION 2: handle_new_user — also seed 8 default cards + active deck
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_username text;
  v_demo_active uuid;
  v_demo_pending uuid;
  v_default_cards text[];
begin
  random_username := 'user_' || substr(new.id::text, 1, 8);
  insert into public.users (id, username)
    values (new.id, random_username);

  -- Pick 8 random common+rare cards as the new user's starter pool
  select array(
    select id from public.cards
      where rarity in ('common', 'rare')
      order by random()
      limit 8
  ) into v_default_cards;

  -- Insert into user_cards
  insert into public.user_cards (user_id, card_id, copies)
    select new.id, c, 1 from unnest(v_default_cards) c
    on conflict (user_id, card_id) do nothing;

  -- Create active deck pre-loaded with those 8 cards
  insert into public.decks (user_id, name, card_ids, is_active)
    values (new.id, '主卡组', coalesce(v_default_cards, '{}'::text[]), true);

  -- Social-loop seed: 1 active demo friend + 1 incoming demo invite
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
    insert into public.friendships (user_id, friend_id, status)
      values (new.id, v_demo_active, 'active'),
             (v_demo_active, new.id, 'active')
      on conflict (user_id, friend_id) do nothing;
  end if;
  if v_demo_pending is not null then
    insert into public.friendships (user_id, friend_id, status)
      values (v_demo_pending, new.id, 'pending')
      on conflict (user_id, friend_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
