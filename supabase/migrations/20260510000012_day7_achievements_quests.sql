-- Day 7: Achievements + Daily Quests
-- Adds: alter users (last_quest_date, last_quest_bonus_date)
-- Adds: 4 tables (achievements, user_achievements, quest_templates, daily_quests) + RLS
-- Adds: 5 RPC (update_progress helper + 4 user-facing)
-- Modifies: submit_workout, end_battle, revive_streak (embed update_progress calls)

-- ============================================================
-- SECTION 1: alter users — quest scheduling fields
-- ============================================================

alter table public.users
  add column if not exists last_quest_date date,
  add column if not exists last_quest_bonus_date date;

-- ============================================================
-- SECTION 2: tables
-- ============================================================

create table if not exists public.achievements (
  id text primary key,
  category text not null,
  name_zh text not null,
  name_en text not null,
  description_zh text not null,
  description_en text not null,
  metric text not null,
  tier int not null default 1,
  target_value int not null,
  reward_kind text not null,
  reward_payload jsonb,
  icon text not null,
  display_order int not null,
  parent_id text references public.achievements(id)
);

create index if not exists achievements_cat_order_idx
  on public.achievements (category, display_order);

create table if not exists public.user_achievements (
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  current_value int not null default 0,
  unlocked_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_unlocked_idx
  on public.user_achievements (user_id, unlocked_at);

create table if not exists public.quest_templates (
  id text primary key,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  metric text not null,
  target_min int not null,
  target_max int not null,
  reward_xp int not null,
  description_zh text not null,
  description_en text not null,
  active boolean not null default true
);

create table if not exists public.daily_quests (
  user_id uuid not null references public.users(id) on delete cascade,
  quest_date date not null,
  slot int not null check (slot in (1, 2, 3)),
  template_id text not null references public.quest_templates(id),
  metric text not null,
  target_value int not null,
  current_value int not null default 0,
  reward_xp int not null,
  completed_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, quest_date, slot)
);

create index if not exists daily_quests_user_date_idx
  on public.daily_quests (user_id, quest_date);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.quest_templates enable row level security;
alter table public.daily_quests enable row level security;

drop policy if exists "achievements_anon_read" on public.achievements;
drop policy if exists "quest_templates_anon_read" on public.quest_templates;
drop policy if exists "user_achievements_owner_read" on public.user_achievements;
drop policy if exists "daily_quests_owner_read" on public.daily_quests;

create policy "achievements_anon_read" on public.achievements
  for select using (true);
create policy "quest_templates_anon_read" on public.quest_templates
  for select using (true);
create policy "user_achievements_owner_read" on public.user_achievements
  for select using (user_id = auth.uid());
create policy "daily_quests_owner_read" on public.daily_quests
  for select using (user_id = auth.uid());

-- ============================================================
-- SECTION 3: seed achievements (18 rows, 5 categories)
-- ============================================================

insert into public.achievements
  (id, category, name_zh, name_en, description_zh, description_en, metric, tier, target_value, reward_kind, reward_payload, icon, display_order, parent_id)
values
  ('workout_001', 'workout', '运动达人 I', 'Workout Enthusiast I', '完成第一次运动', 'Complete your first workout', 'workout_count', 1, 1, 'xp', '{"xp":50}'::jsonb, 'IconRun', 1, null),
  ('workout_010', 'workout', '运动达人 II', 'Workout Enthusiast II', '累积完成 10 次运动', 'Complete 10 workouts total', 'workout_count', 2, 10, 'xp', '{"xp":100}'::jsonb, 'IconRun', 2, 'workout_001'),
  ('workout_050', 'workout', '运动达人 III', 'Workout Enthusiast III', '累积完成 50 次运动', 'Complete 50 workouts total', 'workout_count', 3, 50, 'xp', '{"xp":300}'::jsonb, 'IconRun', 3, 'workout_010'),
  ('workout_200', 'workout', '运动达人 IV', 'Workout Enthusiast IV', '累积完成 200 次运动', 'Complete 200 workouts total', 'workout_count', 4, 200, 'protect', '{}'::jsonb, 'IconRun', 4, 'workout_050'),
  ('streak_03', 'streak', '连击之神 I', 'Streak Master I', '达到 3 天连击', 'Reach a 3-day streak', 'streak_max', 1, 3, 'xp', '{"xp":80}'::jsonb, 'IconFlame', 1, null),
  ('streak_07', 'streak', '连击之神 II', 'Streak Master II', '达到 7 天连击', 'Reach a 7-day streak', 'streak_max', 2, 7, 'xp', '{"xp":200}'::jsonb, 'IconFlame', 2, 'streak_03'),
  ('streak_30', 'streak', '连击之神 III', 'Streak Master III', '达到 30 天连击', 'Reach a 30-day streak', 'streak_max', 3, 30, 'protect', '{}'::jsonb, 'IconFlame', 3, 'streak_07'),
  ('streak_100', 'streak', '连击之神 IV', 'Streak Master IV', '达到 100 天连击', 'Reach a 100-day streak', 'streak_max', 4, 100, 'badge_only', '{}'::jsonb, 'IconFlame', 4, 'streak_30'),
  ('cards_05', 'cards', '卡组初现', 'Card Collector I', '收集 5 张不同卡牌', 'Collect 5 unique cards', 'card_unique_count', 1, 5, 'xp', '{"xp":100}'::jsonb, 'IconCards', 1, null),
  ('cards_20', 'cards', '卡组大师', 'Card Collector II', '收集 20 张不同卡牌', 'Collect 20 unique cards', 'card_unique_count', 2, 20, 'xp', '{"xp":300}'::jsonb, 'IconCards', 2, 'cards_05'),
  ('cards_legendary', 'cards', '传说收藏家', 'Legend Hunter', '抽到第 1 张传说卡', 'Draw your first legendary card', 'legendary_card_count', 1, 1, 'badge_only', '{}'::jsonb, 'IconStar', 3, null),
  ('arena_01', 'arena', 'Arena 之星 I', 'Arena Star I', 'Arena 胜利 1 次', 'Win 1 Arena battle', 'arena_wins', 1, 1, 'xp', '{"xp":50}'::jsonb, 'IconSwords', 1, null),
  ('arena_10', 'arena', 'Arena 之星 II', 'Arena Star II', 'Arena 胜利 10 次', 'Win 10 Arena battles', 'arena_wins', 2, 10, 'xp', '{"xp":200}'::jsonb, 'IconSwords', 2, 'arena_01'),
  ('arena_50', 'arena', 'Arena 之星 III', 'Arena Star III', 'Arena 胜利 50 次', 'Win 50 Arena battles', 'arena_wins', 3, 50, 'protect', '{}'::jsonb, 'IconSwords', 3, 'arena_10'),
  ('arena_total_50', 'arena', '实战派', 'Battle Veteran', 'Arena 出战 50 次', 'Fight 50 Arena battles', 'arena_battles', 1, 50, 'xp', '{"xp":250}'::jsonb, 'IconShield', 4, null),
  ('sport_03', 'special', '多面手', 'All-Rounder', '体验 3 种不同的运动类型', 'Experience 3 different sport types', 'workout_sport_count', 1, 3, 'xp', '{"xp":100}'::jsonb, 'IconBarbell', 1, null),
  ('protect_used_10', 'special', '危机生还', 'Crisis Survivor', '使用过保护卡 10 次', 'Use protect cards 10 times', 'protect_card_used', 1, 10, 'xp', '{"xp":200}'::jsonb, 'IconShieldCheck', 2, null),
  ('revive_01', 'special', '凤凰涅槃', 'Phoenix Reborn', '复活成功 1 次', 'Successfully revive once', 'revive_count', 1, 1, 'xp', '{"xp":150}'::jsonb, 'IconFlame', 3, null)
on conflict (id) do nothing;

-- ============================================================
-- SECTION 4: seed quest_templates (9 rows)
-- ============================================================

insert into public.quest_templates
  (id, difficulty, metric, target_min, target_max, reward_xp, description_zh, description_en)
values
  ('q_easy_run1',      'easy',   'workout_count',         1, 1,  50,  '完成 {n} 次任意运动',           'Complete {n} workout'),
  ('q_easy_arena1',    'easy',   'arena_battles',         1, 1,  50,  '在 Arena 出战 {n} 次',          'Fight {n} Arena battle'),
  ('q_med_dur30',      'medium', 'workout_minutes',       30, 45, 150, '累积运动 {n} 分钟',             'Accumulate {n} minutes of workout'),
  ('q_med_sport2',     'medium', 'workout_sport_count',   2, 2,  150, '体验 {n} 种不同的运动类型',     'Try {n} different sport types'),
  ('q_med_arenawin1',  'medium', 'arena_wins',            1, 1,  150, 'Arena 胜利 {n} 次',             'Win {n} Arena battle'),
  ('q_hard_dur60',     'hard',   'workout_minutes',       60, 90, 300, '累积运动 {n} 分钟',             'Accumulate {n} minutes of workout'),
  ('q_hard_sport3',    'hard',   'workout_sport_count',   3, 3,  300, '完成 {n} 种不同 sport 的训练',  'Complete {n} different sport types'),
  ('q_hard_arenawin2', 'hard',   'arena_wins',            2, 2,  300, 'Arena 胜利 {n} 次',             'Win {n} Arena battles'),
  ('q_hard_legend',    'hard',   'legendary_card_count',  1, 1,  300, '抽到 {n} 张传说卡',             'Draw {n} legendary card')
on conflict (id) do nothing;

-- ============================================================
-- SECTION 5: update_progress helper RPC
-- ============================================================

create or replace function public.update_progress(
  p_user_id uuid,
  p_metric text,
  p_delta int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ach record;
  v_new_value int;
begin
  -- 1. update user_achievements for all achievements with matching metric
  for v_ach in
    select id, target_value from public.achievements where metric = p_metric
  loop
    insert into public.user_achievements (user_id, achievement_id, current_value)
      values (p_user_id, v_ach.id, 0)
      on conflict (user_id, achievement_id) do nothing;

    if p_metric = 'streak_max' then
      update public.user_achievements
        set current_value = greatest(current_value, p_delta)
        where user_id = p_user_id and achievement_id = v_ach.id
        returning current_value into v_new_value;
    else
      update public.user_achievements
        set current_value = current_value + p_delta
        where user_id = p_user_id and achievement_id = v_ach.id
        returning current_value into v_new_value;
    end if;

    if v_new_value >= v_ach.target_value then
      update public.user_achievements
        set unlocked_at = coalesce(unlocked_at, now())
        where user_id = p_user_id and achievement_id = v_ach.id;
    end if;
  end loop;

  -- 2. update today's daily_quests with matching metric
  if p_metric = 'streak_max' then
    update public.daily_quests
      set current_value = greatest(current_value, p_delta)
      where user_id = p_user_id
        and quest_date = current_date
        and metric = p_metric;
  else
    update public.daily_quests
      set current_value = current_value + p_delta
      where user_id = p_user_id
        and quest_date = current_date
        and metric = p_metric;
  end if;

  update public.daily_quests
    set completed_at = coalesce(completed_at, now())
    where user_id = p_user_id
      and quest_date = current_date
      and current_value >= target_value
      and completed_at is null;
end;
$$;

revoke all on function public.update_progress(uuid, text, int) from public;

-- ============================================================
-- SECTION 6: get_achievements RPC
-- ============================================================

create or replace function public.get_achievements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  -- ensure all achievements have a user_achievements row for this user
  insert into public.user_achievements (user_id, achievement_id, current_value)
    select v_user_id, a.id, 0 from public.achievements a
    on conflict (user_id, achievement_id) do nothing;

  select jsonb_build_object(
    'categories',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key', cat.category,
        'achievements', cat.achievements
      ) order by cat.min_order
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total', (select count(*) from public.achievements),
      'unlocked', (select count(*) from public.user_achievements where user_id = v_user_id and unlocked_at is not null),
      'claimable', (select count(*) from public.user_achievements where user_id = v_user_id and unlocked_at is not null and claimed_at is null)
    )
  ) into v_result
  from (
    select
      a.category,
      min(a.display_order) as min_order,
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'name_zh', a.name_zh,
          'name_en', a.name_en,
          'description_zh', a.description_zh,
          'description_en', a.description_en,
          'tier', a.tier,
          'target', a.target_value,
          'current', coalesce(ua.current_value, 0),
          'icon', a.icon,
          'parent_id', a.parent_id,
          'unlocked_at', ua.unlocked_at,
          'claimed_at', ua.claimed_at,
          'reward_kind', a.reward_kind,
          'reward_payload', a.reward_payload
        ) order by a.display_order
      ) as achievements
    from public.achievements a
    left join public.user_achievements ua
      on ua.achievement_id = a.id and ua.user_id = v_user_id
    group by a.category
  ) cat;

  return v_result;
end;
$$;

grant execute on function public.get_achievements() to anon, authenticated;

-- ============================================================
-- SECTION 7: claim_achievement RPC
-- ============================================================

create or replace function public.claim_achievement(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_ach record;
  v_ua record;
  v_card record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  select * into v_ach from public.achievements where id = p_id;
  if not found then raise exception 'achievement not found'; end if;

  select * into v_ua from public.user_achievements
    where user_id = v_user_id and achievement_id = p_id;

  if v_ua is null or v_ua.unlocked_at is null then
    raise exception 'not unlocked';
  end if;
  if v_ua.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  if v_ach.reward_kind = 'xp' then
    update public.users
      set weekly_xp = weekly_xp + (v_ach.reward_payload->>'xp')::int,
          lifetime_xp = lifetime_xp + (v_ach.reward_payload->>'xp')::int
      where id = v_user_id;
  elsif v_ach.reward_kind = 'protect' then
    update public.users
      set protect_cards = least(3, protect_cards + 1)
      where id = v_user_id;
  elsif v_ach.reward_kind = 'card' then
    select * into v_card from public.cards where id = (v_ach.reward_payload->>'card_id');
    if found then
      insert into public.user_cards (user_id, card_id, copies)
        values (v_user_id, v_card.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;
      update public.decks
        set card_ids = card_ids || v_card.id
        where user_id = v_user_id;
    end if;
  end if;

  update public.user_achievements
    set claimed_at = now()
    where user_id = v_user_id and achievement_id = p_id;

  return jsonb_build_object(
    'ok', true,
    'reward_kind', v_ach.reward_kind,
    'reward_payload', v_ach.reward_payload,
    'achievement_id', p_id
  );
end;
$$;

grant execute on function public.claim_achievement(text) to anon, authenticated;

-- ============================================================
-- SECTION 8: get_daily_quests RPC
-- ============================================================

create or replace function public.get_daily_quests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user record;
  v_today date := current_date;
  v_template record;
  v_target int;
  v_result jsonb;
  v_diff text;
  v_slot int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  select * into v_user from public.users where id = v_user_id;

  if v_user.last_quest_date is null or v_user.last_quest_date < v_today then
    delete from public.daily_quests
      where user_id = v_user_id and quest_date < v_today;

    v_slot := 1;
    foreach v_diff in array array['easy', 'medium', 'hard']::text[]
    loop
      select * into v_template from public.quest_templates
        where difficulty = v_diff and active = true
        order by random() limit 1;

      if found then
        v_target := v_template.target_min +
          floor(random() * (v_template.target_max - v_template.target_min + 1))::int;

        insert into public.daily_quests
          (user_id, quest_date, slot, template_id, metric, target_value, current_value, reward_xp)
          values (v_user_id, v_today, v_slot, v_template.id, v_template.metric, v_target, 0, v_template.reward_xp)
          on conflict (user_id, quest_date, slot) do nothing;
      end if;

      v_slot := v_slot + 1;
    end loop;

    update public.users set last_quest_date = v_today where id = v_user_id;

    -- refresh v_user to read updated last_quest_bonus_date for response
    select * into v_user from public.users where id = v_user_id;
  end if;

  select jsonb_build_object(
    'quests',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'slot', dq.slot,
        'difficulty', t.difficulty,
        'metric', dq.metric,
        'description_zh', replace(t.description_zh, '{n}', dq.target_value::text),
        'description_en', replace(t.description_en, '{n}', dq.target_value::text),
        'target', dq.target_value,
        'current', dq.current_value,
        'reward_xp', dq.reward_xp,
        'completed_at', dq.completed_at,
        'claimed_at', dq.claimed_at
      ) order by dq.slot
    ), '[]'::jsonb),
    'all_completed_bonus_claimed', coalesce(v_user.last_quest_bonus_date = v_today, false)
  ) into v_result
  from public.daily_quests dq
  join public.quest_templates t on t.id = dq.template_id
  where dq.user_id = v_user_id and dq.quest_date = v_today;

  return v_result;
end;
$$;

grant execute on function public.get_daily_quests() to anon, authenticated;

-- ============================================================
-- SECTION 9: claim_quest RPC (single + bonus)
-- ============================================================

create or replace function public.claim_quest(p_slot int, p_claim_bonus boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_today date := current_date;
  v_quest record;
  v_user record;
  v_card record;
  v_total_claimed int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  if p_claim_bonus then
    select * into v_user from public.users where id = v_user_id;
    if v_user.last_quest_bonus_date = v_today then
      raise exception 'bonus already claimed';
    end if;

    select count(*) into v_total_claimed
      from public.daily_quests
      where user_id = v_user_id and quest_date = v_today and claimed_at is not null;
    if v_total_claimed < 3 then
      raise exception 'not all quests claimed';
    end if;

    update public.users
      set weekly_xp = weekly_xp + 200,
          lifetime_xp = lifetime_xp + 200,
          last_quest_bonus_date = v_today
      where id = v_user_id;

    select * into v_card from public.cards
      where rarity = 'common' order by random() limit 1;
    if found then
      insert into public.user_cards (user_id, card_id, copies)
        values (v_user_id, v_card.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;
      update public.decks
        set card_ids = card_ids || v_card.id
        where user_id = v_user_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'kind', 'bonus',
      'xp', 200,
      'card_id', v_card.id
    );
  end if;

  select * into v_quest from public.daily_quests
    where user_id = v_user_id and quest_date = v_today and slot = p_slot;

  if not found then raise exception 'quest not found'; end if;
  if v_quest.completed_at is null then raise exception 'not completed'; end if;
  if v_quest.claimed_at is not null then raise exception 'already claimed'; end if;

  update public.users
    set weekly_xp = weekly_xp + v_quest.reward_xp,
        lifetime_xp = lifetime_xp + v_quest.reward_xp
    where id = v_user_id;

  update public.daily_quests
    set claimed_at = now()
    where user_id = v_user_id and quest_date = v_today and slot = p_slot;

  return jsonb_build_object(
    'ok', true,
    'kind', 'quest',
    'slot', p_slot,
    'xp', v_quest.reward_xp
  );
end;
$$;

grant execute on function public.claim_quest(int, boolean) to anon, authenticated;

-- ============================================================
-- SECTION 10: embed update_progress in submit_workout / finalize_battle / revive_streak
-- Full re-replace of each RPC; identical body + Day 7 progress hooks before final return.
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
  v_first_sport_today boolean := false;
  v_card_is_new boolean := false;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

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

  select * into v_user from users where id = v_user_id for update;
  if not found then
    raise exception 'user row missing for auth uid: %', v_user_id;
  end if;

  -- Day 7: capture "first time this sport today" before INSERT workouts
  if not exists (
    select 1 from workouts
    where user_id = v_user_id
      and sport_id = p_sport_id
      and (created_at at time zone 'utc')::date = v_today
  ) then
    v_first_sport_today := true;
  end if;

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

  if v_user.last_workout_date is null then
    v_new_streak := 1;
    v_streak_status := 'new';
    insert into streaks (user_id, start_date, length, status)
      values (v_user_id, v_today, 1, 'active');
  else
    v_gap := v_today - v_user.last_workout_date;

    if v_gap = 0 then
      v_new_streak := v_user.current_streak;
      v_streak_status := 'same_day';
    elsif v_gap = 1 then
      v_new_streak := v_user.current_streak + 1;
      v_streak_status := 'continued';
      update streaks set length = v_new_streak
        where user_id = v_user_id and status = 'active';
    else
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

  v_protect_after := v_user.protect_cards - case when v_protect_consumed then 1 else 0 end;
  if (now() - v_user.last_protect_grant_at) >= interval '7 days' and v_protect_after < 3 then
    v_protect_granted := true;
    v_protect_after := v_protect_after + 1;
  end if;

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

  insert into workouts (user_id, sport_id, duration_minutes, intensity, xp_gained, cards_drawn)
    values (v_user_id, p_sport_id, p_duration_minutes, p_intensity, v_xp_gained, array[v_drawn_card_id]);

  -- Day 7: capture "first time owning this card" before UPSERT user_cards
  if not exists (
    select 1 from user_cards where user_id = v_user_id and card_id = v_drawn_card_id
  ) then
    v_card_is_new := true;
  end if;

  insert into user_cards (user_id, card_id, copies)
    values (v_user_id, v_drawn_card_id, 1)
    on conflict (user_id, card_id) do update
    set copies = user_cards.copies + 1;

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

  -- ===== Day 7: progress hooks =====
  perform public.update_progress(v_user_id, 'workout_count', 1);
  perform public.update_progress(v_user_id, 'workout_minutes', p_duration_minutes);
  if v_first_sport_today then
    perform public.update_progress(v_user_id, 'workout_sport_count', 1);
  end if;
  perform public.update_progress(v_user_id, 'streak_max', v_new_streak);
  if v_card_is_new then
    perform public.update_progress(v_user_id, 'card_unique_count', 1);
  end if;
  if v_rarity = 'legendary' then
    perform public.update_progress(v_user_id, 'legendary_card_count', 1);
  end if;
  if v_protect_consumed then
    perform public.update_progress(v_user_id, 'protect_card_used', 1);
  end if;

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

-- ----- finalize_battle -----

create or replace function public.finalize_battle(p_battle_id bigint, p_log jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_battle battles%rowtype;
  v_npc npc_opponents%rowtype;
  v_attacker_hp int;
  v_defender_hp int;
  v_winner uuid;
  v_xp_gained int := 0;
  v_xp_bonus_pct int := 0;
  v_old_score int := 0;
  v_new_score int := 0;
  v_milestone_crossed boolean := false;
  v_base_reward_xp int := 0;
  v_attacker_heal int := 0;
  v_defender_heal int := 0;
  v_log jsonb;
  v_last_idx int;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  select * into v_battle
    from battles where id = p_battle_id and attacker_id = v_user_id
    for update;
  if not found then
    raise exception 'battle not found or not yours: %', p_battle_id using errcode = '22023';
  end if;

  if v_battle.winner_id is not null then
    return jsonb_build_object(
      'result', case when v_battle.winner_id = v_user_id then 'win' else 'lose' end,
      'xp_gained', v_battle.attacker_xp_delta,
      'base_reward_xp', case when v_battle.npc_id is not null then (select reward_xp from npc_opponents where id = v_battle.npc_id) else 0 end,
      'final_attacker_hp', coalesce((v_battle.log->-1->>'attacker_hp_after')::int, 100),
      'final_defender_hp', coalesce((v_battle.log->-1->>'defender_hp_after')::int, 100),
      'new_season_score', (select season_score from users where id = v_user_id),
      'score_milestone_crossed', false,
      'idempotent', true
    );
  end if;

  if p_log is null or jsonb_array_length(p_log) <> 16 then
    raise exception 'log must have exactly 16 entries (8 turns × 2 attacks)' using errcode = '22023';
  end if;

  v_last_idx := jsonb_array_length(p_log) - 1;
  v_attacker_hp := (p_log->v_last_idx->>'attacker_hp_after')::int;
  v_defender_hp := (p_log->v_last_idx->>'defender_hp_after')::int;

  select coalesce(sum(ability_value), 0) into v_attacker_heal
    from cards
    where id = any(v_battle.attacker_deck_ids)
      and ability_kind = 'heal'
      and ability_trigger = 'on_battle_end';
  select coalesce(sum(ability_value), 0) into v_defender_heal
    from cards
    where id = any(v_battle.defender_deck_ids)
      and ability_kind = 'heal'
      and ability_trigger = 'on_battle_end';

  v_attacker_hp := v_attacker_hp + v_attacker_heal;
  v_defender_hp := v_defender_hp + v_defender_heal;

  v_log := p_log;
  if v_attacker_heal > 0 or v_defender_heal > 0 then
    v_log := jsonb_set(v_log, array[v_last_idx::text, 'attacker_hp_after'], to_jsonb(v_attacker_hp));
    v_log := jsonb_set(v_log, array[v_last_idx::text, 'defender_hp_after'], to_jsonb(v_defender_hp));
  end if;

  if v_attacker_hp > v_defender_hp then
    v_winner := v_user_id;
    select * into v_npc from npc_opponents where id = v_battle.npc_id;
    v_base_reward_xp := v_npc.reward_xp;
    select coalesce(sum(ability_value), 0) into v_xp_bonus_pct
      from cards
      where id = any(v_battle.attacker_deck_ids)
        and ability_kind = 'xp_bonus'
        and ability_trigger = 'on_battle_end';
    v_xp_gained := round(v_npc.reward_xp * (1 + v_xp_bonus_pct::numeric / 100));
  end if;

  update battles set
    winner_id = v_winner,
    log = v_log,
    attacker_xp_delta = v_xp_gained
    where id = p_battle_id;

  if v_xp_gained > 0 then
    select season_score into v_old_score from users where id = v_user_id;
    update users set
      xp = xp + v_xp_gained,
      season_score = season_score + (v_xp_gained / 4)
      where id = v_user_id
      returning season_score into v_new_score;
    v_milestone_crossed := floor(v_old_score / 100.0) < floor(v_new_score / 100.0);
  else
    select season_score into v_new_score from users where id = v_user_id;
  end if;

  -- ===== Day 7: progress hooks =====
  perform public.update_progress(v_user_id, 'arena_battles', 1);
  if v_winner = v_user_id then
    perform public.update_progress(v_user_id, 'arena_wins', 1);
  end if;

  return jsonb_build_object(
    'result', case when v_winner is not null then 'win' else 'lose' end,
    'xp_gained', v_xp_gained,
    'base_reward_xp', v_base_reward_xp,
    'final_attacker_hp', v_attacker_hp,
    'final_defender_hp', v_defender_hp,
    'new_season_score', v_new_score,
    'score_milestone_crossed', v_milestone_crossed
  );
end; $$;

grant execute on function public.finalize_battle(bigint, jsonb) to authenticated;

-- ----- revive_streak -----

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

  if v_user.freeze_xp_until is not null and v_user.freeze_xp_until > now() then
    raise exception 'already revived' using errcode = '28000';
  end if;

  if v_user.last_workout_date is null
     or v_user.last_workout_date < (v_today - 7) then
    raise exception 'revive window closed' using errcode = '22023';
  end if;

  if v_user.current_streak <> 0 then
    raise exception 'streak not broken' using errcode = '22023';
  end if;

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

  -- ===== Day 7: progress hook =====
  perform public.update_progress(v_user_id, 'revive_count', 1);

  return jsonb_build_object(
    'revived_streak', v_revived,
    'freeze_until', v_freeze_until
  );
end; $$;

grant execute on function public.revive_streak() to authenticated;
