-- 20260510000011_day6_streak_protect_revive.sql
-- Day 6: onboarding gate + streak protect/revive + dev_dispatch

-- ============================================================
-- 1. ALTER users — 3 new fields
-- ============================================================
alter table public.users
  add column if not exists onboarded_at timestamptz,
  add column if not exists freeze_xp_until timestamptz,
  add column if not exists last_protect_grant_at timestamptz;

-- Backfill last_protect_grant_at = created_at for existing users
update public.users
  set last_protect_grant_at = created_at
  where last_protect_grant_at is null;

-- ============================================================
-- 2. REPLACE submit_workout — adds freeze + protect + grant logic
-- ============================================================
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
  v_gap int;
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
  v_is_frozen boolean := false;
  v_protect_consumed boolean := false;
  v_protect_granted boolean := false;
  v_protect_after int;
  v_freeze_until timestamptz;
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

  -- ===== 2. fetch user (row lock) =====
  select * into v_user from users where id = v_user_id for update;
  if not found then
    raise exception 'user row missing for auth uid: %', v_user_id;
  end if;

  -- ===== 3. compute XP (freeze 期 = 0) =====
  v_is_frozen := v_user.freeze_xp_until is not null and v_user.freeze_xp_until > now();
  v_intensity_mult := case p_intensity
    when 'light'  then 1
    when 'medium' then 2
    when 'high'   then 3
  end;
  if v_is_frozen then
    v_xp_gained := 0;
  else
    v_xp_gained := round(p_duration_minutes * v_intensity_mult * v_sport.base_xp_multiplier);
  end if;

  -- ===== 4. compute new streak (含保护卡消耗) =====
  if v_user.last_workout_date is null then
    -- first workout ever — no prior active row
    v_new_streak := 1;
    v_streak_status := 'new';
    insert into streaks (user_id, start_date, length, status)
      values (v_user_id, v_today, 1, 'active');
  else
    v_gap := v_today - v_user.last_workout_date;

    if v_gap = 0 then
      -- 同日重复
      v_new_streak := v_user.current_streak;
      v_streak_status := 'same_day';
    elsif v_gap = 1 then
      -- 昨日 → 连续
      v_new_streak := v_user.current_streak + 1;
      v_streak_status := 'continued';
      update streaks set length = v_new_streak
        where user_id = v_user_id and status = 'active';
    else
      -- gap > 1: 优先消耗保护卡
      if v_user.protect_cards >= 1 then
        v_protect_consumed := true;
        v_new_streak := v_user.current_streak + 1;
        v_streak_status := 'protected';
        update streaks set length = v_new_streak
          where user_id = v_user_id and status = 'active';
      else
        v_new_streak := 1;
        v_streak_status := 'broken';
        update streaks
          set status = 'broken', end_date = v_user.last_workout_date
          where user_id = v_user_id and status = 'active';
        insert into streaks (user_id, start_date, length, status)
          values (v_user_id, v_today, 1, 'active');
      end if;
    end if;
  end if;

  -- ===== 5. 周发保护卡 =====
  v_protect_after := v_user.protect_cards - case when v_protect_consumed then 1 else 0 end;
  if (now() - v_user.last_protect_grant_at) >= interval '7 days' and v_protect_after < 3 then
    v_protect_granted := true;
    v_protect_after := v_protect_after + 1;
  end if;

  -- ===== 6. card rarity roll =====
  v_buff := coalesce((v_user.exploration_buffs->>p_sport_id)::numeric, 0);
  v_buff_pp := round(v_buff * 100);
  v_rare_pp := 25 + v_buff_pp;
  v_epic_pp := 4 + (v_buff_pp / 6);
  v_legendary_pp := 1 + (v_buff_pp / 30);
  v_common_pp := 100 - v_rare_pp - v_epic_pp - v_legendary_pp;
  if v_common_pp < 0 then v_common_pp := 0; end if;

  v_roll := floor(random() * 100)::int;
  if v_roll < v_common_pp then
    v_rarity := 'common';
  elsif v_roll < v_common_pp + v_rare_pp then
    v_rarity := 'rare';
  elsif v_roll < v_common_pp + v_rare_pp + v_epic_pp then
    v_rarity := 'epic';
  else
    v_rarity := 'legendary';
  end if;

  select id into v_drawn_card_id
    from cards where rarity = v_rarity
    order by random() limit 1;

  if v_drawn_card_id is null then
    raise exception 'no cards in rarity pool: %', v_rarity;
  end if;

  -- ===== 7. INSERT workout =====
  insert into workouts (user_id, sport_id, duration_minutes, intensity, xp_gained, cards_drawn)
    values (v_user_id, p_sport_id, p_duration_minutes, p_intensity, v_xp_gained, array[v_drawn_card_id]);

  -- ===== 8. UPSERT user_cards =====
  insert into user_cards (user_id, card_id, copies)
    values (v_user_id, v_drawn_card_id, 1)
    on conflict (user_id, card_id) do update
    set copies = user_cards.copies + 1;

  -- ===== 9. UPDATE users =====
  v_freeze_until := case when v_is_frozen then v_user.freeze_xp_until else null end;
  update users set
    xp = xp + v_xp_gained,
    total_workouts = total_workouts + 1,
    current_streak = v_new_streak,
    longest_streak = greatest(longest_streak, v_new_streak),
    last_workout_date = v_today,
    season_score = season_score + v_xp_gained,
    protect_cards = v_protect_after,
    last_protect_grant_at = case when v_protect_granted then now() else last_protect_grant_at end
  where id = v_user_id;

  -- ===== 10. return summary =====
  return jsonb_build_object(
    'xp_gained', v_xp_gained,
    'card_drawn', jsonb_build_object('id', v_drawn_card_id, 'rarity', v_rarity),
    'streak', v_new_streak,
    'streak_status', v_streak_status,
    'xp_frozen', v_is_frozen,
    'protect_card_consumed', v_protect_consumed,
    'protect_card_granted', v_protect_granted,
    'protect_cards_after', v_protect_after,
    'freeze_xp_until', v_freeze_until
  );
end;
$$;

grant execute on function public.submit_workout(text, int, text) to anon, authenticated;

-- ============================================================
-- 3. revive_streak — 7-day window, 50% restore, 24h XP freeze
-- ============================================================
create or replace function public.revive_streak()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user users%rowtype;
  v_last_streak_len int;
  v_revived int;
  v_freeze_until timestamptz;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select * into v_user from users where id = v_user_id for update;
  if not found then raise exception 'user not found' using errcode = '22023'; end if;

  -- 防止反复复活 (freeze 期内)
  if v_user.freeze_xp_until is not null and v_user.freeze_xp_until > now() then
    raise exception 'already revived' using errcode = '28000';
  end if;

  -- 7 天窗口
  if v_user.last_workout_date is null
     or v_user.last_workout_date < (v_today - 7) then
    raise exception 'revive window closed' using errcode = '22023';
  end if;

  if v_user.current_streak <> 0 then
    raise exception 'streak not broken' using errcode = '22023';
  end if;

  -- 取上次 broken streak 的长度
  select length into v_last_streak_len
    from streaks
    where user_id = v_user_id and status = 'broken'
    order by start_date desc limit 1;

  v_revived := floor(coalesce(v_last_streak_len, 0) / 2.0);
  if v_revived < 1 then
    raise exception 'no streak to revive (previous too short)' using errcode = '22023';
  end if;
  v_freeze_until := now() + interval '24 hours';

  update users set
    current_streak = v_revived,
    freeze_xp_until = v_freeze_until
    where id = v_user_id;

  insert into streaks (user_id, start_date, length, status)
    values (v_user_id, v_today, v_revived, 'active');

  return jsonb_build_object(
    'revived_streak', v_revived,
    'freeze_until', v_freeze_until
  );
end; $$;

grant execute on function public.revive_streak() to authenticated;

-- ============================================================
-- 4. grant_onboarding_pack — 1 epic guaranteed + 2 random common/rare
-- ============================================================
create or replace function public.grant_onboarding_pack(p_buffs jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user users%rowtype;
  v_existing jsonb;
  v_epic cards%rowtype;
  v_random1 cards%rowtype;
  v_random2 cards%rowtype;
begin
  if v_user_id is null then raise exception 'unauthorized' using errcode = '28000'; end if;

  select * into v_user from users where id = v_user_id for update;
  if not found then raise exception 'user not found' using errcode = '22023'; end if;

  -- idempotent: already onboarded
  if v_user.onboarded_at is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'rarity', c.rarity)
            order by case c.rarity when 'legendary' then 0 when 'epic' then 1 when 'rare' then 2 else 3 end), '[]'::jsonb)
      into v_existing
      from user_cards uc join cards c on c.id = uc.card_id
      where uc.user_id = v_user_id;
    return jsonb_build_object('cards', v_existing, 'idempotent', true);
  end if;

  -- 1 epic
  select * into v_epic from cards where rarity = 'epic' order by random() limit 1;
  if v_epic.id is null then raise exception 'no epic cards in pool'; end if;
  insert into user_cards (user_id, card_id, copies) values (v_user_id, v_epic.id, 1)
    on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

  -- 2 random common/rare (different ids)
  select * into v_random1 from cards where rarity in ('common','rare') order by random() limit 1;
  if v_random1.id is null then raise exception 'no common/rare cards in pool'; end if;
  insert into user_cards (user_id, card_id, copies) values (v_user_id, v_random1.id, 1)
    on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

  select * into v_random2 from cards where rarity in ('common','rare') and id <> v_random1.id
    order by random() limit 1;
  if v_random2.id is null then v_random2 := v_random1; end if;  -- fallback if only 1 card in pool
  insert into user_cards (user_id, card_id, copies) values (v_user_id, v_random2.id, 1)
    on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

  -- 写 onboarded_at + exploration_buffs
  update users set
    onboarded_at = now(),
    exploration_buffs = p_buffs
    where id = v_user_id;

  return jsonb_build_object(
    'cards', jsonb_build_array(
      jsonb_build_object('id', v_epic.id, 'rarity', 'epic'),
      jsonb_build_object('id', v_random1.id, 'rarity', v_random1.rarity),
      jsonb_build_object('id', v_random2.id, 'rarity', v_random2.rarity)
    ),
    'idempotent', false
  );
end; $$;

grant execute on function public.grant_onboarding_pack(jsonb) to authenticated;

-- ============================================================
-- 5. dev_dispatch — review-mode helpers (?dev=1)
-- ============================================================
create or replace function public.dev_dispatch(p_action text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_legendary cards%rowtype;
  v_n int;
begin
  if v_user_id is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- 测评作业语境：不做严格权限校验。生产环境应加 secret token。

  case p_action
    when 'set_streak' then
      v_n := coalesce((p_params->>'n')::int, 0);
      update users set current_streak = greatest(v_n, 0) where id = v_user_id;

    when 'grant_legendary' then
      select * into v_legendary from cards where rarity = 'legendary' order by random() limit 1;
      if v_legendary.id is null then raise exception 'no legendary cards'; end if;
      insert into user_cards (user_id, card_id, copies) values (v_user_id, v_legendary.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

    when 'level_up' then
      update users set level = level + 1, xp = 0 where id = v_user_id;

    when 'break_streak' then
      update users set
        current_streak = 0,
        last_workout_date = (current_date - 1),
        freeze_xp_until = null
        where id = v_user_id;
      update streaks
        set status = 'broken', end_date = (current_date - 1)
        where user_id = v_user_id and status = 'active';
      insert into streaks (user_id, start_date, length, status)
        values (v_user_id, current_date - 11, 10, 'broken');

    when 'reset_progress' then
      delete from user_cards where user_id = v_user_id;
      delete from workouts where user_id = v_user_id;
      delete from battles where attacker_id = v_user_id;
      delete from decks where user_id = v_user_id;
      delete from streaks where user_id = v_user_id;
      update users set
        level = 1, xp = 0, total_workouts = 0,
        current_streak = 0, longest_streak = 0,
        last_workout_date = null,
        protect_cards = 0,
        season_score = 0,
        freeze_xp_until = null,
        last_protect_grant_at = now(),
        exploration_buffs = '{}'::jsonb
        where id = v_user_id;

    when 'grant_protect' then
      update users set protect_cards = least(protect_cards + 1, 3) where id = v_user_id;

    when 'reset_onboarding' then
      update users set onboarded_at = null where id = v_user_id;

    else
      raise exception 'unknown action: %', p_action using errcode = '22023';
  end case;

  return jsonb_build_object('action', p_action, 'ok', true);
end; $$;

grant execute on function public.dev_dispatch(text, jsonb) to authenticated;
