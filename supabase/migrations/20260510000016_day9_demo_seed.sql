-- 20260510000016_day9_demo_seed.sql
-- Day 9: 8 demo users with rich progression data, for leaderboard / social-feel scenarios.
-- These users do NOT log in (no auth.identities, empty encrypted_password).

-- ============================================================
-- SECTION 1: auth.users (minimal seed; needed to satisfy public.users → auth.users FK)
-- ============================================================
insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo01@pulse.test', 'authenticated', 'authenticated', '', now() - interval '60 days', now() - interval '60 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111102'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo02@pulse.test', 'authenticated', 'authenticated', '', now() - interval '45 days', now() - interval '45 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111103'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo03@pulse.test', 'authenticated', 'authenticated', '', now() - interval '40 days', now() - interval '40 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111104'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo04@pulse.test', 'authenticated', 'authenticated', '', now() - interval '50 days', now() - interval '50 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111105'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo05@pulse.test', 'authenticated', 'authenticated', '', now() - interval '30 days', now() - interval '30 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111106'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo06@pulse.test', 'authenticated', 'authenticated', '', now() - interval '35 days', now() - interval '35 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111107'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo07@pulse.test', 'authenticated', 'authenticated', '', now() - interval '20 days', now() - interval '20 days', now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-4111-8111-111111111108'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo08@pulse.test', 'authenticated', 'authenticated', '', now() - interval '90 days', now() - interval '90 days', now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- ============================================================
-- SECTION 2: public.users
-- ============================================================
insert into public.users (id, username, level, xp, total_workouts, current_streak, longest_streak, last_workout_date, season_score, exploration_buffs, protect_cards, created_at, updated_at, last_protect_grant_at, onboarded_at)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, 'speedster_777',  14, 5800, 92,  18, 25, current_date,         1450, '{"running":0.30,"hiit":0.25}'::jsonb,    2, now() - interval '60 days', now(), now() - interval '2 days', now() - interval '60 days'),
  ('11111111-1111-4111-8111-111111111102'::uuid, 'iron_will_42',   11, 3900, 68,  12, 18, current_date,          980, '{"strength":0.20,"boxing":0.15}'::jsonb, 1, now() - interval '45 days', now(), now() - interval '4 days', now() - interval '45 days'),
  ('11111111-1111-4111-8111-111111111103'::uuid, 'flexible_jane',   9, 2700, 45,   7, 14, current_date,          720, '{"yoga":0.20,"flex":0.15}'::jsonb,       1, now() - interval '40 days', now(), now() - interval '5 days', now() - interval '40 days'),
  ('11111111-1111-4111-8111-111111111104'::uuid, 'hiit_demon',     13, 4500, 78,  21, 21, current_date,         1180, '{"hiit":0.30,"running":0.20}'::jsonb,    3, now() - interval '50 days', now(), now() - interval '1 day',  now() - interval '50 days'),
  ('11111111-1111-4111-8111-111111111105'::uuid, 'yoga_panda',      6, 1400, 28,   5, 10, current_date,          410, '{"yoga":0.25}'::jsonb,                   0, now() - interval '30 days', now(), now() - interval '6 days', now() - interval '30 days'),
  ('11111111-1111-4111-8111-111111111106'::uuid, 'basket_king',     8, 2200, 36,   0, 11, current_date - 5,      580, '{"basketball":0.20}'::jsonb,             0, now() - interval '35 days', now(), now() - interval '7 days', now() - interval '35 days'),
  ('11111111-1111-4111-8111-111111111107'::uuid, 'climber_mary',    4,  850, 18,   3,  8, current_date,          240, '{"climbing":0.20}'::jsonb,               0, now() - interval '20 days', now(), now() - interval '3 days', now() - interval '20 days'),
  ('11111111-1111-4111-8111-111111111108'::uuid, 'cardio_lord',    16, 7200,120,  30, 45, current_date,         1800, '{"running":0.40,"swimming":0.30}'::jsonb, 3, now() - interval '90 days', now(), now() - interval '1 day',  now() - interval '90 days')
on conflict (id) do nothing;

-- ============================================================
-- SECTION 3: workouts (spread across last 30 days, varying counts per user)
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
  v_sports text[] := array['running','hiit','swimming','cycling','yoga','basketball','strength','climbing','badminton','tennis','football'];
begin
  for v_demo in
    select id, total_workouts from public.users
    where id::text like '11111111-1111-4111-8111-111111111%'
  loop
    -- spread roughly half of total_workouts across the last 30 days as actual rows
    -- (the user's total_workouts column already reflects lifetime, we just need recent rows for period leaderboards)
    v_n := least(v_demo.total_workouts, 5 + (random() * 12)::int);
    for i in 1..v_n loop
      v_sport     := v_sports[1 + (random() * (array_length(v_sports, 1) - 1))::int];
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
    where id::text like '11111111-1111-4111-8111-111111111%'
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
  ('11111111-1111-4111-8111-111111111101'::uuid, current_date - 17, 18, 'active'),
  ('11111111-1111-4111-8111-111111111102'::uuid, current_date - 11, 12, 'active'),
  ('11111111-1111-4111-8111-111111111103'::uuid, current_date - 6,   7, 'active'),
  ('11111111-1111-4111-8111-111111111104'::uuid, current_date - 20, 21, 'active'),
  ('11111111-1111-4111-8111-111111111105'::uuid, current_date - 4,   5, 'active'),
  ('11111111-1111-4111-8111-111111111106'::uuid, current_date - 16, 11, 'broken'),
  ('11111111-1111-4111-8111-111111111107'::uuid, current_date - 2,   3, 'active'),
  ('11111111-1111-4111-8111-111111111108'::uuid, current_date - 29, 30, 'active');
