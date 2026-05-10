-- 20260510000020_day11_demo_friends_decks.sql
-- Day 11: seed demo social graph + active decks for the 8 demo users.
-- Reviewer logs in → /friends shows demos and PVP can fire immediately.

-- ============================================================
-- SECTION 1: 5 active friendships (10 double-rows) between demos
-- ============================================================
insert into public.friendships (user_id, friend_id, status)
values
  -- speedster_777 ↔ iron_will_42
  ('00000001-0001-4001-8001-000000000001'::uuid, '00000002-0002-4002-8002-000000000002'::uuid, 'active'),
  ('00000002-0002-4002-8002-000000000002'::uuid, '00000001-0001-4001-8001-000000000001'::uuid, 'active'),
  -- speedster_777 ↔ hiit_demon
  ('00000001-0001-4001-8001-000000000001'::uuid, '00000004-0004-4004-8004-000000000004'::uuid, 'active'),
  ('00000004-0004-4004-8004-000000000004'::uuid, '00000001-0001-4001-8001-000000000001'::uuid, 'active'),
  -- iron_will_42 ↔ flexible_jane
  ('00000002-0002-4002-8002-000000000002'::uuid, '00000003-0003-4003-8003-000000000003'::uuid, 'active'),
  ('00000003-0003-4003-8003-000000000003'::uuid, '00000002-0002-4002-8002-000000000002'::uuid, 'active'),
  -- cardio_lord ↔ hiit_demon
  ('00000008-0008-4008-8008-000000000008'::uuid, '00000004-0004-4004-8004-000000000004'::uuid, 'active'),
  ('00000004-0004-4004-8004-000000000004'::uuid, '00000008-0008-4008-8008-000000000008'::uuid, 'active'),
  -- cardio_lord ↔ basket_king
  ('00000008-0008-4008-8008-000000000008'::uuid, '00000006-0006-4006-8006-000000000006'::uuid, 'active'),
  ('00000006-0006-4006-8006-000000000006'::uuid, '00000008-0008-4008-8008-000000000008'::uuid, 'active')
on conflict (user_id, friend_id) do nothing;

-- ============================================================
-- SECTION 2: set active deck (8 cards) for each demo user
-- Pick highest-rarity 8 cards from their user_cards (legendary > epic > rare > common).
-- ============================================================
do $$
declare
  v_demo record;
  v_picked text[];
begin
  for v_demo in
    select id from public.users
    where id::text like '0000000_-000_-400_-800_-%'
  loop
    select array(
      select uc.card_id
      from public.user_cards uc
        join public.cards c on c.id = uc.card_id
      where uc.user_id = v_demo.id
      order by
        case c.rarity
          when 'legendary' then 1
          when 'epic' then 2
          when 'rare' then 3
          else 4
        end,
        random()
      limit 8
    ) into v_picked;

    if array_length(v_picked, 1) = 8 then
      update public.decks
        set card_ids = v_picked
        where user_id = v_demo.id and is_active = true;
    end if;
  end loop;
end $$;
