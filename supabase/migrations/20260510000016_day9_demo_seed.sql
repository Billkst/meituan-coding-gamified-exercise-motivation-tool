-- 20260510000016_day9_demo_seed.sql
-- Day 9: 8 demo users with rich progression data, for leaderboard / social-feel scenarios.
-- These users do NOT log in (no auth.identities, empty encrypted_password).
--
-- IMPORTANT: schema 1 has a `handle_new_user()` trigger on auth.users that auto-creates
-- public.users (with username = 'user_' || substr(id::text, 1, 8)) + decks. So:
--   - demo UUIDs MUST have distinct first 8 hex chars (else trigger violates username UNIQUE)
--   - we let the trigger create the public.users row, then UPDATE the columns we want
--   - we do NOT insert into public.users directly

-- ============================================================
-- SECTION 1: auth.users (8 distinct prefixes 00000001 .. 00000008)
-- ============================================================
insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000001-0001-4001-8001-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo01@pulse.test', 'authenticated', 'authenticated', '', now() - interval '60 days', now() - interval '60 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000002-0002-4002-8002-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo02@pulse.test', 'authenticated', 'authenticated', '', now() - interval '45 days', now() - interval '45 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000003-0003-4003-8003-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo03@pulse.test', 'authenticated', 'authenticated', '', now() - interval '40 days', now() - interval '40 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000004-0004-4004-8004-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo04@pulse.test', 'authenticated', 'authenticated', '', now() - interval '50 days', now() - interval '50 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000005-0005-4005-8005-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo05@pulse.test', 'authenticated', 'authenticated', '', now() - interval '30 days', now() - interval '30 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000006-0006-4006-8006-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo06@pulse.test', 'authenticated', 'authenticated', '', now() - interval '35 days', now() - interval '35 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000007-0007-4007-8007-000000000007'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo07@pulse.test', 'authenticated', 'authenticated', '', now() - interval '20 days', now() - interval '20 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000008-0008-4008-8008-000000000008'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo08@pulse.test', 'authenticated', 'authenticated', '', now() - interval '90 days', now() - interval '90 days', now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- handle_new_user trigger has now created public.users + decks rows for each demo with auto-username 'user_00000001' etc.

-- ============================================================
-- SECTION 2: update public.users with real progression data
-- ============================================================
update public.users set
  username = 'speedster_777', level = 14, xp = 5800, total_workouts = 92,  current_streak = 18, longest_streak = 25, last_workout_date = current_date,     season_score = 1450, exploration_buffs = '{"running":0.30,"hiit":0.25}'::jsonb,    protect_cards = 2, created_at = now() - interval '60 days', last_protect_grant_at = now() - interval '2 days', onboarded_at = now() - interval '60 days'
  where id = '00000001-0001-4001-8001-000000000001'::uuid;
update public.users set
  username = 'iron_will_42', level = 11, xp = 3900, total_workouts = 68,  current_streak = 12, longest_streak = 18, last_workout_date = current_date,     season_score = 980,  exploration_buffs = '{"strength":0.20,"boxing":0.15}'::jsonb, protect_cards = 1, created_at = now() - interval '45 days', last_protect_grant_at = now() - interval '4 days', onboarded_at = now() - interval '45 days'
  where id = '00000002-0002-4002-8002-000000000002'::uuid;
update public.users set
  username = 'flexible_jane', level = 9,  xp = 2700, total_workouts = 45,  current_streak = 7,  longest_streak = 14, last_workout_date = current_date,     season_score = 720,  exploration_buffs = '{"yoga":0.20,"flex":0.15}'::jsonb,      protect_cards = 1, created_at = now() - interval '40 days', last_protect_grant_at = now() - interval '5 days', onboarded_at = now() - interval '40 days'
  where id = '00000003-0003-4003-8003-000000000003'::uuid;
update public.users set
  username = 'hiit_demon',    level = 13, xp = 4500, total_workouts = 78,  current_streak = 21, longest_streak = 21, last_workout_date = current_date,     season_score = 1180, exploration_buffs = '{"hiit":0.30,"running":0.20}'::jsonb,   protect_cards = 3, created_at = now() - interval '50 days', last_protect_grant_at = now() - interval '1 day',  onboarded_at = now() - interval '50 days'
  where id = '00000004-0004-4004-8004-000000000004'::uuid;
update public.users set
  username = 'yoga_panda',    level = 6,  xp = 1400, total_workouts = 28,  current_streak = 5,  longest_streak = 10, last_workout_date = current_date,     season_score = 410,  exploration_buffs = '{"yoga":0.25}'::jsonb,                   protect_cards = 0, created_at = now() - interval '30 days', last_protect_grant_at = now() - interval '6 days', onboarded_at = now() - interval '30 days'
  where id = '00000005-0005-4005-8005-000000000005'::uuid;
update public.users set
  username = 'basket_king',   level = 8,  xp = 2200, total_workouts = 36,  current_streak = 0,  longest_streak = 11, last_workout_date = current_date - 5, season_score = 580,  exploration_buffs = '{"basketball":0.20}'::jsonb,             protect_cards = 0, created_at = now() - interval '35 days', last_protect_grant_at = now() - interval '7 days', onboarded_at = now() - interval '35 days'
  where id = '00000006-0006-4006-8006-000000000006'::uuid;
update public.users set
  username = 'climber_mary',  level = 4,  xp = 850,  total_workouts = 18,  current_streak = 3,  longest_streak = 8,  last_workout_date = current_date,     season_score = 240,  exploration_buffs = '{"climbing":0.20}'::jsonb,               protect_cards = 0, created_at = now() - interval '20 days', last_protect_grant_at = now() - interval '3 days', onboarded_at = now() - interval '20 days'
  where id = '00000007-0007-4007-8007-000000000007'::uuid;
update public.users set
  username = 'cardio_lord',   level = 16, xp = 7200, total_workouts = 120, current_streak = 30, longest_streak = 45, last_workout_date = current_date,     season_score = 1800, exploration_buffs = '{"running":0.40,"swimming":0.30}'::jsonb, protect_cards = 3, created_at = now() - interval '90 days', last_protect_grant_at = now() - interval '1 day',  onboarded_at = now() - interval '90 days'
  where id = '00000008-0008-4008-8008-000000000008'::uuid;

-- ============================================================
-- SECTION 3: workouts (spread across last 30 days)
-- ============================================================
do $$
declare
  v_demo record;
  v_n int;
  i int;
  v_sport text;
  v_intensity text;
  v_duration int;
  v_xp int;
  v_when timestamptz;
begin
  for v_demo in
    select id, total_workouts from public.users
    where id::text like '0000000_-000_-400_-800_-%'
  loop
    v_n := least(v_demo.total_workouts, 5 + (random() * 12)::int);
    for i in 1..v_n loop
      -- pick a real sport id straight from the table to avoid FK violations on hardcoded strings
      select id into v_sport from public.sports order by random() limit 1;
      v_intensity := case when random() < 0.4 then 'high' when random() < 0.7 then 'medium' else 'light' end;
      v_duration  := 15 + (random() * 50)::int;
      v_xp        := 30 + (random() * 100)::int;
      v_when      := now() - (interval '1 hour' * (random() * 24 * 30));

      insert into public.workouts (user_id, sport_id, duration_minutes, intensity, xp_gained, cards_drawn, created_at)
        values (v_demo.id, v_sport, v_duration, v_intensity, v_xp, '{}'::text[], v_when);
    end loop;
  end loop;
end $$;

-- ============================================================
-- SECTION 4: user_cards (random N per demo, weighted by level)
-- ============================================================
do $$
declare
  v_demo record;
  v_n_cards int;
begin
  for v_demo in
    select id, level from public.users
    where id::text like '0000000_-000_-400_-800_-%'
  loop
    v_n_cards := least(35, 3 + v_demo.level * 2);

    insert into public.user_cards (user_id, card_id, copies)
    select v_demo.id, c.id, 1 + (random() * 2)::int
    from public.cards c
    order by
      case c.rarity
        when 'common' then 1 + random()
        when 'rare' then 2 + random()
        when 'epic' then 3 + random()
        when 'legendary' then 4 + random()
      end,
      random()
    limit v_n_cards
    on conflict (user_id, card_id) do nothing;
  end loop;
end $$;

-- ============================================================
-- SECTION 5: streaks
-- ============================================================
insert into public.streaks (user_id, start_date, length, status)
values
  ('00000001-0001-4001-8001-000000000001'::uuid, current_date - 17, 18, 'active'),
  ('00000002-0002-4002-8002-000000000002'::uuid, current_date - 11, 12, 'active'),
  ('00000003-0003-4003-8003-000000000003'::uuid, current_date - 6,   7, 'active'),
  ('00000004-0004-4004-8004-000000000004'::uuid, current_date - 20, 21, 'active'),
  ('00000005-0005-4005-8005-000000000005'::uuid, current_date - 4,   5, 'active'),
  ('00000006-0006-4006-8006-000000000006'::uuid, current_date - 16, 11, 'broken'),
  ('00000007-0007-4007-8007-000000000007'::uuid, current_date - 2,   3, 'active'),
  ('00000008-0008-4008-8008-000000000008'::uuid, current_date - 29, 30, 'active');
