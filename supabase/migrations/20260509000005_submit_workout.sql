-- PULSE submit_workout RPC — atomic plpgsql transaction
-- Day 3: 2026-05-09
--
-- Game loop core:
--   inputs:  sport_id, duration_minutes (1-600), intensity (light/medium/high)
--   does:    XP calc · streak update · card draw with rarity roll · DB writes
--   returns: { xp_gained, card_drawn:{id,rarity}, streak, streak_status }
--
-- Atomicity: single function = single transaction. All-or-nothing.
-- Auth:      auth.uid() must be set (anon or authenticated). 可在客户端 anon signin 后调用.
-- Anti-cheat: security definer bypasses RLS. Service-role-equivalent path.
--
-- XP formula:    duration_minutes × intensity_mult × sport.base_xp_multiplier
--                intensity_mult: light=1, medium=2, high=3
-- Card rarity:   baseline 70/25/4/1.
--                exploration_buffs[sport_id] in [0, 0.30] linearly scales:
--                rare_pp += buff×100; epic_pp += buff×100/6; legend_pp += buff×100/30
--                At buff=0.30 (full): 34/55/9/2.
-- Streak:        gap=0 → no change (same-day repeat); gap=1 → +1; gap>=2 → reset to 1.

create or replace function public.submit_workout(
  p_sport_id text,
  p_duration_minutes int,
  p_intensity text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sport sports%rowtype;
  v_user users%rowtype;
  v_intensity_mult int;
  v_xp_gained int;
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := v_today - interval '1 day';
  v_new_streak int;
  v_streak_status text;
  v_buff numeric;
  v_buff_pp int;
  v_rare_pp int;
  v_epic_pp int;
  v_legendary_pp int;
  v_common_pp int;
  v_roll int;
  v_rarity text;
  v_drawn_card_id text;
begin
  -- ===== 0. auth =====
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  -- ===== 1. validate inputs =====
  if p_intensity not in ('light', 'medium', 'high') then
    raise exception 'invalid intensity: %', p_intensity using errcode = '22023';
  end if;
  if p_duration_minutes < 1 or p_duration_minutes > 600 then
    raise exception 'invalid duration: %', p_duration_minutes using errcode = '22023';
  end if;

  select * into v_sport from sports where id = p_sport_id;
  if not found then
    raise exception 'unknown sport: %', p_sport_id using errcode = '22023';
  end if;

  -- ===== 2. compute XP =====
  v_intensity_mult := case p_intensity
    when 'light'  then 1
    when 'medium' then 2
    when 'high'   then 3
  end;
  v_xp_gained := round(p_duration_minutes * v_intensity_mult * v_sport.base_xp_multiplier);

  -- ===== 3. fetch user (row lock) =====
  select * into v_user from users where id = v_user_id for update;
  if not found then
    raise exception 'user row missing for auth uid: %', v_user_id;
  end if;

  -- ===== 4. compute new streak =====
  if v_user.last_workout_date is null or v_user.last_workout_date < v_yesterday then
    -- broken or first workout
    v_new_streak := 1;
    v_streak_status := 'new';
    update streaks
      set status='broken', end_date = v_user.last_workout_date
      where user_id = v_user_id and status = 'active';
    insert into streaks (user_id, start_date, length, status)
      values (v_user_id, v_today, 1, 'active');
  elsif v_user.last_workout_date = v_yesterday then
    v_new_streak := v_user.current_streak + 1;
    v_streak_status := 'continued';
    update streaks
      set length = v_new_streak
      where user_id = v_user_id and status = 'active';
  else
    -- last_workout_date == today: 同日重复, streak 不变
    v_new_streak := v_user.current_streak;
    v_streak_status := 'same_day';
  end if;

  -- ===== 5. card rarity roll =====
  v_buff := coalesce((v_user.exploration_buffs->>p_sport_id)::numeric, 0);
  v_buff_pp := round(v_buff * 100);
  v_rare_pp := 25 + v_buff_pp;
  v_epic_pp := 4 + (v_buff_pp / 6);
  v_legendary_pp := 1 + (v_buff_pp / 30);
  v_common_pp := 100 - v_rare_pp - v_epic_pp - v_legendary_pp;
  if v_common_pp < 0 then v_common_pp := 0; end if;

  v_roll := floor(random() * 100)::int;  -- 0..99
  if v_roll < v_common_pp then
    v_rarity := 'common';
  elsif v_roll < v_common_pp + v_rare_pp then
    v_rarity := 'rare';
  elsif v_roll < v_common_pp + v_rare_pp + v_epic_pp then
    v_rarity := 'epic';
  else
    v_rarity := 'legendary';
  end if;

  -- pick a random card from rarity pool
  select id into v_drawn_card_id
    from cards where rarity = v_rarity
    order by random() limit 1;

  if v_drawn_card_id is null then
    raise exception 'no cards in rarity pool: %', v_rarity;
  end if;

  -- ===== 6. INSERT workout =====
  insert into workouts (user_id, sport_id, duration_minutes, intensity, xp_gained, cards_drawn)
    values (v_user_id, p_sport_id, p_duration_minutes, p_intensity, v_xp_gained, array[v_drawn_card_id]);

  -- ===== 7. UPSERT user_cards (incr copies if exists) =====
  insert into user_cards (user_id, card_id, copies)
    values (v_user_id, v_drawn_card_id, 1)
    on conflict (user_id, card_id) do update
    set copies = user_cards.copies + 1;

  -- ===== 8. UPDATE users =====
  update users set
    xp = xp + v_xp_gained,
    total_workouts = total_workouts + 1,
    current_streak = v_new_streak,
    longest_streak = greatest(longest_streak, v_new_streak),
    last_workout_date = v_today,
    season_score = season_score + v_xp_gained
  where id = v_user_id;

  -- ===== 9. return summary =====
  return jsonb_build_object(
    'xp_gained', v_xp_gained,
    'card_drawn', jsonb_build_object('id', v_drawn_card_id, 'rarity', v_rarity),
    'streak', v_new_streak,
    'streak_status', v_streak_status
  );
end;
$$;

-- Grant execute to anon + authenticated (anon-auth signin is supported)
grant execute on function public.submit_workout(text, int, text) to anon, authenticated;
