# Day 7 Plan — 成就系统 + 每日任务

**Spec:** `docs/superpowers/specs/2026-05-10-day7-achievements-quests-design.md`
**Date:** 2026-05-10
**Estimated:** ~19h / 1.5-2 工作日 / 28 离散 task
**Strategy:** Schema First + Subagent-Driven，每个 task 单独 commit、可回退

---

## File Structure

新增文件：
```
supabase/migrations/20260510000012_day7_achievements_quests.sql

src/types/db.ts                                    # 增 4 type
src/lib/quests/random.ts                           # pickQuestTemplate
src/lib/quests/random.test.ts
src/lib/achievements/group.ts                      # groupByCategory
src/lib/achievements/group.test.ts

src/api/achievements.ts                            # 2 hooks
src/api/quests.ts                                  # 2 hooks

src/pages/Achievements.tsx
src/components/achievements/AchievementCategorySection.tsx
src/components/achievements/AchievementRow.tsx
src/components/AchievementUnlockToast.tsx

src/components/dashboard/DailyQuestsCard.tsx
src/components/dashboard/QuestRow.tsx
src/components/dashboard/QuestBonusRow.tsx
```

修改文件：
```
src/components/Sidebar.tsx                         # 加 "成就" item
src/pages/Dashboard.tsx                            # 挂 DailyQuestsCard + AchievementUnlockToast
src/App.tsx                                        # 加 /achievements route
src/lib/i18n.ts                                    # 加 keys
```

---

## Phase 1 — Migration（10 task，单文件多 SECTION）

### Task 1: 创建 migration 文件骨架 + alter users

**File:** `supabase/migrations/20260510000012_day7_achievements_quests.sql`

```sql
-- Day 7: Achievements + Daily Quests
-- Adds: alter users (last_quest_date, last_quest_bonus_date)
-- Adds: 4 tables (achievements, user_achievements, quest_templates, daily_quests)
-- Adds: 5 RPC (update_progress helper + 4 user-facing)
-- Modifies: submit_workout, end_battle, revive_streak (embed update_progress calls)

-- ===== SECTION 1: alter users =====

alter table public.users
  add column if not exists last_quest_date date,
  add column if not exists last_quest_bonus_date date;

-- ===== SECTION 2: tables =====
-- (Task 2 fills)

-- ===== SECTION 3: seed achievements =====
-- (Task 3 fills)

-- ===== SECTION 4: seed quest_templates =====
-- (Task 4 fills)

-- ===== SECTION 5: update_progress helper =====
-- (Task 5 fills)

-- ===== SECTION 6: get_achievements =====
-- (Task 6 fills)

-- ===== SECTION 7: claim_achievement =====
-- (Task 7 fills)

-- ===== SECTION 8: get_daily_quests =====
-- (Task 8 fills)

-- ===== SECTION 9: claim_quest =====
-- (Task 9 fills)

-- ===== SECTION 10: embed update_progress in submit_workout / end_battle / revive_streak =====
-- (Task 10 fills)
```

**Verify:** `head -20 supabase/migrations/20260510000012_day7_achievements_quests.sql`

**Commit:** `feat(day7): migration 12 skeleton + alter users for quest dates`

---

### Task 2: SECTION 2 — 4 张表 + RLS

**位置:** SECTION 2 placeholder

```sql
create table public.achievements (
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

create index achievements_cat_order_idx on public.achievements (category, display_order);

create table public.user_achievements (
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  current_value int not null default 0,
  unlocked_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, achievement_id)
);

create index user_achievements_unlocked_idx on public.user_achievements (user_id, unlocked_at);

create table public.quest_templates (
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

create table public.daily_quests (
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

create index daily_quests_user_date_idx on public.daily_quests (user_id, quest_date);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.quest_templates enable row level security;
alter table public.daily_quests enable row level security;

create policy "achievements_anon_read" on public.achievements for select using (true);
create policy "quest_templates_anon_read" on public.quest_templates for select using (true);
create policy "user_achievements_owner_read" on public.user_achievements for select using (user_id = auth.uid());
create policy "daily_quests_owner_read" on public.daily_quests for select using (user_id = auth.uid());
```

**Verify:** SQL 文件包含 4 个 `create table`、4 个 `create policy`、3 个 `create index`。

**Commit:** `feat(day7): 4 tables for achievements + quests with RLS`

---

### Task 3: SECTION 3 — seed achievements (18 行)

**位置:** SECTION 3 placeholder

```sql
insert into public.achievements (id, category, name_zh, name_en, description_zh, description_en, metric, tier, target_value, reward_kind, reward_payload, icon, display_order, parent_id) values
('workout_001', 'workout', '运动达人 I', 'Workout Enthusiast I', '完成第一次运动', 'Complete your first workout', 'workout_count', 1, 1, 'xp', '{"xp":50}', 'IconRun', 1, null),
('workout_010', 'workout', '运动达人 II', 'Workout Enthusiast II', '累积完成 10 次运动', 'Complete 10 workouts total', 'workout_count', 2, 10, 'xp', '{"xp":100}', 'IconRun', 2, 'workout_001'),
('workout_050', 'workout', '运动达人 III', 'Workout Enthusiast III', '累积完成 50 次运动', 'Complete 50 workouts total', 'workout_count', 3, 50, 'xp', '{"xp":300}', 'IconRun', 3, 'workout_010'),
('workout_200', 'workout', '运动达人 IV', 'Workout Enthusiast IV', '累积完成 200 次运动', 'Complete 200 workouts total', 'workout_count', 4, 200, 'protect', '{}', 'IconRun', 4, 'workout_050'),
('streak_03', 'streak', '连击之神 I', 'Streak Master I', '达到 3 天连击', 'Reach a 3-day streak', 'streak_max', 1, 3, 'xp', '{"xp":80}', 'IconFlame', 1, null),
('streak_07', 'streak', '连击之神 II', 'Streak Master II', '达到 7 天连击', 'Reach a 7-day streak', 'streak_max', 2, 7, 'xp', '{"xp":200}', 'IconFlame', 2, 'streak_03'),
('streak_30', 'streak', '连击之神 III', 'Streak Master III', '达到 30 天连击', 'Reach a 30-day streak', 'streak_max', 3, 30, 'protect', '{}', 'IconFlame', 3, 'streak_07'),
('streak_100', 'streak', '连击之神 IV', 'Streak Master IV', '达到 100 天连击', 'Reach a 100-day streak', 'streak_max', 4, 100, 'badge_only', '{}', 'IconFlame', 4, 'streak_30'),
('cards_05', 'cards', '卡组初现', 'Card Collector I', '收集 5 张不同卡牌', 'Collect 5 unique cards', 'card_unique_count', 1, 5, 'xp', '{"xp":100}', 'IconCards', 1, null),
('cards_20', 'cards', '卡组大师', 'Card Collector II', '收集 20 张不同卡牌', 'Collect 20 unique cards', 'card_unique_count', 2, 20, 'xp', '{"xp":300}', 'IconCards', 2, 'cards_05'),
('cards_legendary', 'cards', '传说收藏家', 'Legend Hunter', '抽到第 1 张传说卡', 'Draw your first legendary card', 'legendary_card_count', 1, 1, 'badge_only', '{}', 'IconStar', 3, null),
('arena_01', 'arena', 'Arena 之星 I', 'Arena Star I', 'Arena 胜利 1 次', 'Win 1 Arena battle', 'arena_wins', 1, 1, 'xp', '{"xp":50}', 'IconSwords', 1, null),
('arena_10', 'arena', 'Arena 之星 II', 'Arena Star II', 'Arena 胜利 10 次', 'Win 10 Arena battles', 'arena_wins', 2, 10, 'xp', '{"xp":200}', 'IconSwords', 2, 'arena_01'),
('arena_50', 'arena', 'Arena 之星 III', 'Arena Star III', 'Arena 胜利 50 次', 'Win 50 Arena battles', 'arena_wins', 3, 50, 'protect', '{}', 'IconSwords', 3, 'arena_10'),
('arena_total_50', 'arena', '实战派', 'Battle Veteran', 'Arena 出战 50 次', 'Fight 50 Arena battles', 'arena_battles', 1, 50, 'xp', '{"xp":250}', 'IconShield', 4, null),
('sport_03', 'special', '多面手', 'All-Rounder', '体验 3 种不同的运动类型', 'Experience 3 different sport types', 'workout_sport_count', 1, 3, 'xp', '{"xp":100}', 'IconBarbell', 1, null),
('protect_used_10', 'special', '危机生还', 'Crisis Survivor', '使用过保护卡 10 次', 'Use protect cards 10 times', 'protect_card_used', 1, 10, 'xp', '{"xp":200}', 'IconShieldCheck', 2, null),
('revive_01', 'special', '凤凰涅槃', 'Phoenix Reborn', '复活成功 1 次', 'Successfully revive once', 'revive_count', 1, 1, 'xp', '{"xp":150}', 'IconFlame', 3, null);
```

**Verify:** Migration 含 18 条 insert，覆盖 5 个 category。

**Commit:** `feat(day7): seed 18 achievements (5 categories)`

---

### Task 4: SECTION 4 — seed quest_templates (9 行)

**位置:** SECTION 4 placeholder

```sql
insert into public.quest_templates (id, difficulty, metric, target_min, target_max, reward_xp, description_zh, description_en) values
('q_easy_run1',      'easy',   'workout_count',         1, 1, 50,  '完成 {n} 次任意运动',           'Complete {n} workout'),
('q_easy_arena1',    'easy',   'arena_battles',         1, 1, 50,  '在 Arena 出战 {n} 次',          'Fight {n} Arena battle'),
('q_med_dur30',      'medium', 'workout_minutes',       30, 45, 150, '累积运动 {n} 分钟',           'Accumulate {n} minutes of workout'),
('q_med_sport2',     'medium', 'workout_sport_count',   2, 2, 150, '体验 {n} 种不同的运动类型',     'Try {n} different sport types'),
('q_med_arenawin1',  'medium', 'arena_wins',            1, 1, 150, 'Arena 胜利 {n} 次',             'Win {n} Arena battle'),
('q_hard_dur60',     'hard',   'workout_minutes',       60, 90, 300, '累积运动 {n} 分钟',           'Accumulate {n} minutes of workout'),
('q_hard_sport3',    'hard',   'workout_sport_count',   3, 3, 300, '完成 {n} 种不同 sport 的训练',  'Complete {n} different sport types'),
('q_hard_arenawin2', 'hard',   'arena_wins',            2, 2, 300, 'Arena 胜利 {n} 次',             'Win {n} Arena battles'),
('q_hard_legend',    'hard',   'legendary_card_count',  1, 1, 300, '抽到 {n} 张传说卡',             'Draw {n} legendary card');
```

**Verify:** 含 9 条 insert，难度分布 2/3/4。

**Commit:** `feat(day7): seed 9 quest templates (easy/medium/hard)`

---

### Task 5: SECTION 5 — update_progress helper

**位置:** SECTION 5 placeholder

```sql
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
    select id, target_value, metric from public.achievements where metric = p_metric
  loop
    -- upsert
    insert into public.user_achievements (user_id, achievement_id, current_value)
      values (p_user_id, v_ach.id, 0)
      on conflict (user_id, achievement_id) do nothing;

    -- compute new value (streak_max is special: greatest, not sum)
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

    -- mark unlocked if reached target and not yet unlocked
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

  -- mark completed
  update public.daily_quests
    set completed_at = coalesce(completed_at, now())
    where user_id = p_user_id
      and quest_date = current_date
      and current_value >= target_value
      and completed_at is null;
end;
$$;

revoke all on function public.update_progress(uuid, text, int) from public;
-- only callable by other security definer RPCs (no grant to anon/authenticated)
```

**Verify:** 函数定义存在，含 streak_max 特殊处理分支。

**Commit:** `feat(day7): update_progress helper RPC`

---

### Task 6: SECTION 6 — get_achievements

**位置:** SECTION 6 placeholder

```sql
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

  -- ensure all achievements have a user_achievements row
  insert into public.user_achievements (user_id, achievement_id, current_value)
    select v_user_id, a.id, 0 from public.achievements a
    on conflict (user_id, achievement_id) do nothing;

  -- group by category and return
  select jsonb_build_object(
    'categories',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key', cat.category,
        'achievements', cat.achievements
      ) order by min_order
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total', (select count(*) from achievements),
      'unlocked', (select count(*) from user_achievements where user_id = v_user_id and unlocked_at is not null),
      'claimable', (select count(*) from user_achievements where user_id = v_user_id and unlocked_at is not null and claimed_at is null)
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
```

**Verify:** 函数返回 jsonb，含 categories 和 summary。

**Commit:** `feat(day7): get_achievements RPC`

---

### Task 7: SECTION 7 — claim_achievement

**位置:** SECTION 7 placeholder

```sql
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

  if v_ua.unlocked_at is null then
    raise exception 'not unlocked';
  end if;
  if v_ua.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  -- dispatch reward
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
    -- pick the card_id from payload
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
  -- badge_only: no material reward

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
```

**Verify:** 4 种 reward_kind 分支齐全。

**Commit:** `feat(day7): claim_achievement RPC`

---

### Task 8: SECTION 8 — get_daily_quests

**位置:** SECTION 8 placeholder

```sql
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
  v_quests jsonb;
  v_diff text;
  v_slot int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  select * into v_user from public.users where id = v_user_id;

  -- regenerate if needed
  if v_user.last_quest_date is null or v_user.last_quest_date < v_today then
    -- clear stale (yesterday or older)
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
  end if;

  -- read today's quests + join template for description
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
  ) into v_quests
  from public.daily_quests dq
  join public.quest_templates t on t.id = dq.template_id
  where dq.user_id = v_user_id and dq.quest_date = v_today;

  return v_quests;
end;
$$;

grant execute on function public.get_daily_quests() to anon, authenticated;
```

**Verify:** 含 regen 分支 + select 分支 + 占位符替换 `replace(t.description_zh, '{n}', ...)`。

**Commit:** `feat(day7): get_daily_quests RPC`

---

### Task 9: SECTION 9 — claim_quest

**位置:** SECTION 9 placeholder

```sql
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
  v_total_completed int;
  v_total_claimed int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  if p_claim_bonus then
    -- bonus: requires all 3 quests claimed today AND bonus not yet claimed
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

    -- award bonus: 200 XP + 1 random common card
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

  -- single quest
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
```

**Verify:** 含 bonus 和 single 两条分支，含状态校验。

**Commit:** `feat(day7): claim_quest RPC (single + bonus)`

---

### Task 10: SECTION 10 — 嵌入 update_progress 到既有 RPC

**位置:** SECTION 10 placeholder

注意：这里需要 **完整 replace** `submit_workout`、`end_battle`、`revive_streak`，因为 plpgsql 不支持局部 patch。

读取既有 RPC 完整定义：
```bash
# Day 6 中 submit_workout 的最新定义在 migration 11
grep -n 'create or replace function public.submit_workout' supabase/migrations/20260510000011_day6_streak_protect_revive.sql
```

复制完整 body，在 `return v_result;` 之前插入：

```sql
  -- ===== Day 7: progress hooks =====
  perform public.update_progress(v_user_id, 'workout_count', 1);
  perform public.update_progress(v_user_id, 'workout_minutes', p_duration_min);
  -- 是否首次提交该 sport（today 内）
  if not exists (
    select 1 from public.workouts
    where user_id = v_user_id
      and sport_id = p_sport_id
      and date(submitted_at) = current_date
      and id != v_workout_id
  ) then
    perform public.update_progress(v_user_id, 'workout_sport_count', 1);
  end if;
  perform public.update_progress(v_user_id, 'streak_max', v_new_streak);
  if v_card_is_new then
    perform public.update_progress(v_user_id, 'card_unique_count', 1);
  end if;
  if v_drawn_rarity = 'legendary' then
    perform public.update_progress(v_user_id, 'legendary_card_count', 1);
  end if;
  if v_protect_consumed then
    perform public.update_progress(v_user_id, 'protect_card_used', 1);
  end if;
```

> ⚠️ Implementer 注意：现有 `submit_workout` 中 `v_card_is_new` 和 `v_drawn_rarity` 可能用了不同变量名。读 migration 11 实际定义、用实际变量名替换。如果某变量不存在（比如不区分新旧卡），需要 implementer 在 migration 12 同时新增 `v_card_is_new` 计算逻辑（在 grant_card 之前 select 是否已有该 card_id 的 user_cards 行 → boolean）。**这是本 task 唯一的非平凡修改。**

`end_battle`：
```sql
  -- ===== Day 7: progress hooks =====
  perform public.update_progress(v_winner_user_id, 'arena_battles', 1);
  perform public.update_progress(v_loser_user_id, 'arena_battles', 1);
  if v_winner_user_id is not null then
    perform public.update_progress(v_winner_user_id, 'arena_wins', 1);
  end if;
```

> ⚠️ end_battle 变量名同样要校对。如果 `end_battle` 是单方调用（只更新调用者状态，对手是 NPC），那只 hook 调用者：
> ```sql
> perform public.update_progress(p_user_id, 'arena_battles', 1);
> if v_result = 'win' then perform public.update_progress(p_user_id, 'arena_wins', 1); end if;
> ```

`revive_streak`：
```sql
  -- ===== Day 7: progress hook =====
  if v_revived >= 1 then
    perform public.update_progress(v_user_id, 'revive_count', 1);
  end if;
```

**Verify:**
- migration 12 文件包含 3 个 `create or replace function` 完整 replace
- `grep "update_progress" supabase/migrations/20260510000012_day7_achievements_quests.sql` 出现 ≥ 10 次

**Commit:** `feat(day7): embed update_progress into submit_workout/end_battle/revive_streak`

---

### Task 11: push migration 12

执行：
```bash
SUPABASE_DB_PASSWORD='<URL-encoded-password>' bunx supabase db push --include-all \
  --db-url "$(cat supabase/.temp/pooler-url)"
```

如果 IPv4 直连失败，按 CLAUDE.md 中"Supabase migration push" 一节 workaround 走 pooler URL。

**Verify:**
- Supabase Studio 看到 4 张新表 + 18 + 9 seed 行
- `select count(*) from public.achievements` = 18
- `select count(*) from public.quest_templates` = 9
- `select * from pg_proc where proname in ('update_progress', 'get_achievements', 'claim_achievement', 'get_daily_quests', 'claim_quest')` 5 行

**Commit:** No code change; this is an ops task. Note in next commit message that migration is live.

---

## Phase 2 — Types + helpers（3 task）

### Task 12: types/db.ts 加 4 type

读 `src/types/db.ts`，追加：

```ts
export type AchievementCategory = 'workout' | 'streak' | 'cards' | 'arena' | 'special'
export type RewardKind = 'xp' | 'protect' | 'card' | 'badge_only'
export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export interface AchievementRow {
  id: string
  category: AchievementCategory
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  metric: string
  tier: number
  target_value: number
  reward_kind: RewardKind
  reward_payload: Record<string, unknown>
  icon: string
  display_order: number
  parent_id: string | null
}

export interface UserAchievementRow {
  user_id: string
  achievement_id: string
  current_value: number
  unlocked_at: string | null
  claimed_at: string | null
}

export interface QuestTemplateRow {
  id: string
  difficulty: QuestDifficulty
  metric: string
  target_min: number
  target_max: number
  reward_xp: number
  description_zh: string
  description_en: string
  active: boolean
}

export interface DailyQuestRow {
  user_id: string
  quest_date: string
  slot: number
  template_id: string
  metric: string
  target_value: number
  current_value: number
  reward_xp: number
  completed_at: string | null
  claimed_at: string | null
}
```

修改 `UserRow` 添加：
```ts
  last_quest_date: string | null
  last_quest_bonus_date: string | null
```

**Verify:** `bunx tsc --noEmit` 干净。

**Commit:** `feat(day7): db types for achievements + quests`

---

### Task 13: lib/quests/random.ts + test (TDD)

**TDD 顺序：先写测试，跑红，然后实现。**

`src/lib/quests/random.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { pickQuestTemplate } from './random'
import type { QuestTemplateRow } from '@/types/db'

const fakePool: QuestTemplateRow[] = [
  { id: 'a', difficulty: 'easy', metric: 'workout_count', target_min: 1, target_max: 1, reward_xp: 50, description_zh: 'a', description_en: 'a', active: true },
  { id: 'b', difficulty: 'easy', metric: 'arena_battles', target_min: 1, target_max: 1, reward_xp: 50, description_zh: 'b', description_en: 'b', active: true },
  { id: 'c', difficulty: 'medium', metric: 'workout_minutes', target_min: 30, target_max: 45, reward_xp: 150, description_zh: 'c', description_en: 'c', active: true },
]

describe('pickQuestTemplate', () => {
  it('returns a template matching the requested difficulty', () => {
    const result = pickQuestTemplate(fakePool, 'easy')
    expect(result?.difficulty).toBe('easy')
  })

  it('rolls target within [target_min, target_max]', () => {
    const tpl = fakePool[2]  // medium, range 30-45
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const result = pickQuestTemplate([tpl], 'medium')
    expect(result?.target).toBeGreaterThanOrEqual(30)
    expect(result?.target).toBeLessThanOrEqual(45)
    vi.restoreAllMocks()
  })

  it('returns null when pool has no matching difficulty', () => {
    expect(pickQuestTemplate(fakePool, 'hard')).toBeNull()
  })

  it('filters inactive templates', () => {
    const inactivePool: QuestTemplateRow[] = [{ ...fakePool[0], active: false }]
    expect(pickQuestTemplate(inactivePool, 'easy')).toBeNull()
  })
})
```

实现 `src/lib/quests/random.ts`:
```ts
import type { QuestTemplateRow, QuestDifficulty } from '@/types/db'

export interface PickedQuest {
  template: QuestTemplateRow
  target: number
}

export function pickQuestTemplate(
  pool: QuestTemplateRow[],
  difficulty: QuestDifficulty,
): PickedQuest | null {
  const filtered = pool.filter(t => t.difficulty === difficulty && t.active)
  if (filtered.length === 0) return null
  const tpl = filtered[Math.floor(Math.random() * filtered.length)]
  const target = tpl.target_min + Math.floor(Math.random() * (tpl.target_max - tpl.target_min + 1))
  return { template: tpl, target }
}
```

**Verify:** `bun run test src/lib/quests/random.test.ts` 4 个测试全过。

**Commit:** `feat(day7): pickQuestTemplate helper + 4 tests`

---

### Task 14: lib/achievements/group.ts + test (TDD)

**TDD：测试先红。**

`src/lib/achievements/group.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupByCategory, type AchievementVM } from './group'

const sample: AchievementVM[] = [
  { id: 'a1', category: 'workout', display_order: 1 } as AchievementVM,
  { id: 'a2', category: 'workout', display_order: 2 } as AchievementVM,
  { id: 'b1', category: 'arena', display_order: 1 } as AchievementVM,
  { id: 's1', category: 'special', display_order: 3 } as AchievementVM,
]

describe('groupByCategory', () => {
  it('groups achievements by category', () => {
    const grouped = groupByCategory(sample)
    expect(grouped.workout).toHaveLength(2)
    expect(grouped.arena).toHaveLength(1)
    expect(grouped.special).toHaveLength(1)
  })

  it('preserves display_order within category', () => {
    const grouped = groupByCategory(sample)
    expect(grouped.workout[0].id).toBe('a1')
    expect(grouped.workout[1].id).toBe('a2')
  })

  it('returns empty arrays for missing categories', () => {
    const grouped = groupByCategory([])
    expect(grouped.workout).toEqual([])
    expect(grouped.streak).toEqual([])
    expect(grouped.cards).toEqual([])
    expect(grouped.arena).toEqual([])
    expect(grouped.special).toEqual([])
  })
})
```

实现 `src/lib/achievements/group.ts`:
```ts
import type { AchievementCategory } from '@/types/db'

export interface AchievementVM {
  id: string
  category: AchievementCategory
  display_order: number
  // ...其他字段在 page 中渲染时使用
  [key: string]: unknown
}

export type GroupedAchievements = Record<AchievementCategory, AchievementVM[]>

const CATEGORIES: AchievementCategory[] = ['workout', 'streak', 'cards', 'arena', 'special']

export function groupByCategory(achievements: AchievementVM[]): GroupedAchievements {
  const result: GroupedAchievements = {
    workout: [], streak: [], cards: [], arena: [], special: [],
  }
  for (const a of achievements) {
    if (a.category in result) {
      result[a.category].push(a)
    }
  }
  for (const cat of CATEGORIES) {
    result[cat].sort((x, y) => x.display_order - y.display_order)
  }
  return result
}
```

**Verify:** `bun run test src/lib/achievements/group.test.ts` 3 个测试全过。

**Commit:** `feat(day7): groupByCategory helper + 3 tests`

---

## Phase 3 — API hooks（2 task）

### Task 15: api/achievements.ts

`src/api/achievements.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

export interface AchievementsResponse {
  categories: Array<{
    key: 'workout' | 'streak' | 'cards' | 'arena' | 'special'
    achievements: AchievementItem[]
  }>
  summary: { total: number; unlocked: number; claimable: number }
}

export interface AchievementItem {
  id: string
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  tier: number
  target: number
  current: number
  icon: string
  parent_id: string | null
  unlocked_at: string | null
  claimed_at: string | null
  reward_kind: 'xp' | 'protect' | 'card' | 'badge_only'
  reward_payload: Record<string, unknown>
}

export function useAchievements() {
  const userId = useAuthStore(s => s.user?.id)
  return useQuery({
    queryKey: ['achievements', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_achievements' as never)
      if (error) throw error
      return data as AchievementsResponse
    },
  })
}

export function useClaimAchievement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('claim_achievement' as never, { p_id: id } as never)
      if (error) throw error
      return data as { ok: true; reward_kind: string; reward_payload: Record<string, unknown>; achievement_id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })
}
```

**Verify:** `bunx tsc --noEmit` 干净。

**Commit:** `feat(day7): useAchievements + useClaimAchievement hooks`

---

### Task 16: api/quests.ts

`src/api/quests.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

export interface QuestsResponse {
  quests: QuestItem[]
  all_completed_bonus_claimed: boolean
}

export interface QuestItem {
  slot: number
  difficulty: 'easy' | 'medium' | 'hard'
  metric: string
  description_zh: string
  description_en: string
  target: number
  current: number
  reward_xp: number
  completed_at: string | null
  claimed_at: string | null
}

export function useDailyQuests() {
  const userId = useAuthStore(s => s.user?.id)
  return useQuery({
    queryKey: ['daily_quests', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_quests' as never)
      if (error) throw error
      return data as QuestsResponse
    },
  })
}

export function useClaimQuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { slot?: number; bonus?: boolean }) => {
      const params = args.bonus
        ? { p_slot: 0, p_claim_bonus: true }
        : { p_slot: args.slot, p_claim_bonus: false }
      const { data, error } = await supabase.rpc('claim_quest' as never, params as never)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_quests'] })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })
}
```

**Verify:** `bunx tsc --noEmit` 干净。

**Commit:** `feat(day7): useDailyQuests + useClaimQuest hooks`

---

## Phase 4 — Achievements UI（5 task）

### Task 17: Sidebar 加 "成就" item

读 `src/components/Sidebar.tsx`，在 `Cards` 和 `Arena` 之间插入新 item：

```tsx
import { IconTrophy } from '@tabler/icons-react'

// 在 nav items 数组里加：
{ to: '/achievements', icon: IconTrophy, labelKey: 'sidebar.achievements' as const }
```

i18n keys（先占位，Task 26 集中加）：
- `sidebar.achievements` → "成就" / "Achievements"

**Verify:** Sidebar 渲染时 "成就" item 在 "卡牌" 和 "Arena" 之间。

**Commit:** `feat(day7): sidebar adds achievements link`

---

### Task 18: Achievements page 骨架 + route

`src/pages/Achievements.tsx`:
```tsx
import { useTranslation } from '@/lib/i18n'
import { useAchievements } from '@/api/achievements'
import { AchievementCategorySection } from '@/components/achievements/AchievementCategorySection'

export default function Achievements() {
  const { t } = useTranslation()
  const { data, isLoading } = useAchievements()

  if (isLoading) {
    return (
      <div className="max-w-container mx-auto px-8 py-12">
        <div className="font-mono text-sm text-text-tertiary">{t('common.loading')}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-container mx-auto px-8 py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('achievements.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-2">
        {t('achievements.title')}
      </h1>
      <div className="font-mono text-sm text-text-secondary mb-12 tabular-nums">
        {data.summary.unlocked} / {data.summary.total} {t('achievements.summary_suffix')}
        {data.summary.claimable > 0 && (
          <span className="ml-4 text-accent-primary">
            · {data.summary.claimable} {t('achievements.claimable_suffix')}
          </span>
        )}
      </div>
      <div className="space-y-12">
        {data.categories.map(cat => (
          <AchievementCategorySection key={cat.key} categoryKey={cat.key} achievements={cat.achievements} />
        ))}
      </div>
    </div>
  )
}
```

`src/App.tsx` 加 route：
```tsx
import Achievements from '@/pages/Achievements'
// 在 <Routes> 里加：
<Route path="/achievements" element={<Achievements />} />
```

**Verify:** 浏览器访问 `/achievements` 显示骨架（暂时没有 row 渲染）。

**Commit:** `feat(day7): Achievements page + route`

---

### Task 19: AchievementCategorySection 组件

`src/components/achievements/AchievementCategorySection.tsx`:
```tsx
import { useTranslation } from '@/lib/i18n'
import { AchievementRow } from './AchievementRow'
import type { AchievementItem } from '@/api/achievements'

interface Props {
  categoryKey: 'workout' | 'streak' | 'cards' | 'arena' | 'special'
  achievements: AchievementItem[]
}

export function AchievementCategorySection({ categoryKey, achievements }: Props) {
  const { t } = useTranslation()
  const unlocked = achievements.filter(a => a.unlocked_at).length

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 border-b border-white/10 pb-2">
        <h2 className="font-display font-bold text-lg uppercase tracking-tight">
          {t(`achievements.category.${categoryKey}` as const)}
        </h2>
        <div className="font-mono text-xs text-text-tertiary tabular-nums">
          {unlocked} / {achievements.length}
        </div>
      </div>
      <div className="space-y-3">
        {achievements.map(a => (
          <AchievementRow key={a.id} achievement={a} />
        ))}
      </div>
    </section>
  )
}
```

**Verify:** 组件渲染（暂依赖 AchievementRow，下一 task 完成）。

**Commit:** `feat(day7): AchievementCategorySection component`

---

### Task 20: AchievementRow 组件

`src/components/achievements/AchievementRow.tsx`:
```tsx
import { IconLock, IconCheck } from '@tabler/icons-react'
import * as TablerIcons from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClaimAchievement } from '@/api/achievements'
import type { AchievementItem } from '@/api/achievements'

interface Props {
  achievement: AchievementItem
}

export function AchievementRow({ achievement: a }: Props) {
  const { t, lang } = useTranslation()
  const claim = useClaimAchievement()

  const Icon = (TablerIcons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[a.icon] ?? IconLock
  const progress = Math.min(100, Math.round((a.current / a.target) * 100))
  const isUnlocked = !!a.unlocked_at
  const isClaimed = !!a.claimed_at
  const isClaimable = isUnlocked && !isClaimed

  const rewardLabel = (() => {
    if (a.reward_kind === 'xp') return `+${(a.reward_payload as { xp?: number }).xp ?? 0} XP`
    if (a.reward_kind === 'protect') return t('achievements.reward.protect')
    if (a.reward_kind === 'card') return t('achievements.reward.card')
    return t('achievements.reward.badge_only')
  })()

  return (
    <div
      className={
        'rounded-card border p-4 transition-colors ' +
        (isClaimed ? 'border-white/10 bg-bg-secondary/40 opacity-60' :
          isClaimable ? 'border-accent-primary bg-bg-secondary shadow-glow-standard' :
          'border-white/10 bg-bg-secondary')
      }
    >
      <div className="flex items-center gap-4">
        <div className={'p-2 rounded-button ' + (isUnlocked ? 'bg-accent-primary/20 text-accent-primary' : 'bg-bg-tertiary text-text-tertiary')}>
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-display font-bold text-base text-text-primary truncate">
              {lang === 'zh' ? a.name_zh : a.name_en}
            </div>
            {isClaimed && <IconCheck size={16} className="text-text-tertiary flex-shrink-0" />}
          </div>
          <div className="font-body text-xs text-text-secondary mb-2">
            {lang === 'zh' ? a.description_zh : a.description_en}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={'h-full transition-all ' + (isUnlocked ? 'bg-accent-primary' : 'bg-text-tertiary/50')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-text-tertiary tabular-nums w-16 text-right">
              {a.current}/{a.target}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={'font-mono text-xs uppercase tracking-widest ' + (isUnlocked ? 'text-accent-primary' : 'text-text-tertiary')}>
            {rewardLabel}
          </div>
          {isClaimable ? (
            <button
              onClick={() => claim.mutate(a.id)}
              disabled={claim.isPending}
              className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider text-xs py-1.5 px-4 rounded-button shadow-glow-standard hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {t('achievements.claim_button')}
            </button>
          ) : isClaimed ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
              {t('achievements.claimed_label')}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
```

**Verify:** 浏览器渲染 row：进度条、奖励标签、按钮三态切换正常。

**Commit:** `feat(day7): AchievementRow component`

---

### Task 21: AchievementUnlockToast 组件

`src/components/AchievementUnlockToast.tsx`:
```tsx
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { IconTrophy } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useAchievements } from '@/api/achievements'

export function AchievementUnlockToast() {
  const { t, lang } = useTranslation()
  const { data } = useAchievements()
  const seenIdsRef = useRef<Set<string>>(new Set())
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!data) return

    const allUnlocked = data.categories.flatMap(c =>
      c.achievements.filter(a => a.unlocked_at && !a.claimed_at)
    )

    // first run: hydrate seen set, don't show toast
    if (seenIdsRef.current.size === 0) {
      allUnlocked.forEach(a => seenIdsRef.current.add(a.id))
      return
    }

    const newly = allUnlocked.find(a => !seenIdsRef.current.has(a.id))
    if (newly) {
      seenIdsRef.current.add(newly.id)
      setPending({
        id: newly.id,
        name: lang === 'zh' ? newly.name_zh : newly.name_en,
      })
      setTimeout(() => setPending(null), 5000)
    }
  }, [data, lang])

  if (!pending) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-bg-secondary border border-accent-primary rounded-card px-4 py-3 shadow-glow-hero flex items-center gap-3 animate-slide-down">
      <IconTrophy size={20} className="text-accent-primary" />
      <div className="font-mono text-sm">
        <span className="text-text-tertiary uppercase tracking-widest text-xs mr-2">
          {t('toast.achievement_unlocked')}
        </span>
        <span className="text-text-primary font-display font-bold">{pending.name}</span>
      </div>
      <Link
        to="/achievements"
        className="font-mono text-xs uppercase tracking-widest text-accent-primary hover:underline ml-2"
      >
        {t('toast.achievement_unlocked_cta')} →
      </Link>
    </div>
  )
}
```

挂在 Dashboard.tsx 顶部（Task 25 时一并）。

**Verify:** 组件文件创建。

**Commit:** `feat(day7): AchievementUnlockToast component`

---

## Phase 5 — Quests UI（4 task）

### Task 22: DailyQuestsCard 主组件

`src/components/dashboard/DailyQuestsCard.tsx`:
```tsx
import { useTranslation } from '@/lib/i18n'
import { useDailyQuests } from '@/api/quests'
import { QuestRow } from './QuestRow'
import { QuestBonusRow } from './QuestBonusRow'

export function DailyQuestsCard() {
  const { t } = useTranslation()
  const { data, isLoading } = useDailyQuests()

  if (isLoading || !data) {
    return (
      <div className="bg-bg-secondary border border-white/10 rounded-card p-6">
        <div className="font-mono text-xs text-text-tertiary">{t('common.loading')}</div>
      </div>
    )
  }

  const completed = data.quests.filter(q => q.completed_at).length
  const allClaimed = data.quests.every(q => q.claimed_at)

  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card p-6">
      <div className="flex items-baseline justify-between mb-4 border-b border-white/10 pb-3">
        <h2 className="font-display font-bold text-lg uppercase tracking-tight">
          {t('dashboard.daily_quests.title')}
        </h2>
        <div className="font-mono text-xs text-text-tertiary tabular-nums">
          {completed} / {data.quests.length} {t('dashboard.daily_quests.completed_label')}
        </div>
      </div>
      <div className="space-y-2">
        {data.quests.map(q => <QuestRow key={q.slot} quest={q} />)}
      </div>
      <div className="mt-3 pt-3 border-t border-white/10">
        <QuestBonusRow allClaimed={allClaimed} bonusClaimed={data.all_completed_bonus_claimed} />
      </div>
    </div>
  )
}
```

**Verify:** 文件创建，依赖下一 task 的 QuestRow / QuestBonusRow。

**Commit:** `feat(day7): DailyQuestsCard component`

---

### Task 23: QuestRow 组件

`src/components/dashboard/QuestRow.tsx`:
```tsx
import { IconCheck, IconCircle } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClaimQuest } from '@/api/quests'
import type { QuestItem } from '@/api/quests'

interface Props {
  quest: QuestItem
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-rarity-common',
  medium: 'text-rarity-rare',
  hard: 'text-rarity-epic',
}

export function QuestRow({ quest: q }: Props) {
  const { t, lang } = useTranslation()
  const claim = useClaimQuest()

  const isCompleted = !!q.completed_at
  const isClaimed = !!q.claimed_at

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-shrink-0">
        {isCompleted ? (
          <IconCheck size={16} className="text-accent-primary" />
        ) : (
          <IconCircle size={16} className="text-text-tertiary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-body text-sm text-text-primary">
          {lang === 'zh' ? q.description_zh : q.description_en}
        </div>
        {!isCompleted && q.target > 1 && (
          <div className="font-mono text-[10px] text-text-tertiary tabular-nums mt-0.5">
            {q.current} / {q.target}
          </div>
        )}
      </div>
      <div className={'font-mono text-xs uppercase tracking-widest ' + (DIFFICULTY_COLOR[q.difficulty] ?? '')}>
        +{q.reward_xp} XP
      </div>
      {isCompleted && !isClaimed && (
        <button
          onClick={() => claim.mutate({ slot: q.slot })}
          disabled={claim.isPending}
          className="bg-accent-primary text-bg-primary font-mono text-[10px] uppercase tracking-widest py-1 px-3 rounded-button hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          {t('dashboard.daily_quests.claim_button')}
        </button>
      )}
      {isClaimed && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('dashboard.daily_quests.claimed_label')}
        </span>
      )}
    </div>
  )
}
```

**Verify:** 三态（进行中/可领/已领）样式正确。

**Commit:** `feat(day7): QuestRow component`

---

### Task 24: QuestBonusRow 组件

`src/components/dashboard/QuestBonusRow.tsx`:
```tsx
import { IconGift } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClaimQuest } from '@/api/quests'

interface Props {
  allClaimed: boolean
  bonusClaimed: boolean
}

export function QuestBonusRow({ allClaimed, bonusClaimed }: Props) {
  const { t } = useTranslation()
  const claim = useClaimQuest()

  return (
    <div className="flex items-center gap-3 py-1">
      <IconGift size={16} className={allClaimed && !bonusClaimed ? 'text-accent-primary' : 'text-text-tertiary'} />
      <div className="flex-1 font-mono text-xs uppercase tracking-widest text-text-secondary">
        {t('dashboard.daily_quests.bonus_label')}
      </div>
      <div className="font-mono text-xs text-text-tertiary">
        +200 XP · 1 {t('dashboard.daily_quests.bonus_card')}
      </div>
      {bonusClaimed ? (
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('dashboard.daily_quests.bonus_claimed')}
        </span>
      ) : allClaimed ? (
        <button
          onClick={() => claim.mutate({ bonus: true })}
          disabled={claim.isPending}
          className="bg-accent-primary text-bg-primary font-mono text-[10px] uppercase tracking-widest py-1 px-3 rounded-button hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          {t('dashboard.daily_quests.bonus_claim')}
        </button>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('dashboard.daily_quests.bonus_locked')}
        </span>
      )}
    </div>
  )
}
```

**Verify:** 3 个状态（lock / claim / claimed）样式切换。

**Commit:** `feat(day7): QuestBonusRow component`

---

### Task 25: 接入 Dashboard

读 `src/pages/Dashboard.tsx`，在合适位置插入：

```tsx
import { DailyQuestsCard } from '@/components/dashboard/DailyQuestsCard'
import { AchievementUnlockToast } from '@/components/AchievementUnlockToast'
```

JSX 修改：
- `<AchievementUnlockToast />` 放在 page 根容器顶部（紧贴根 div 内首行）
- `<DailyQuestsCard />` 放在 ReviveBanner 之后、主 KPI 卡片之前（"今日任务"是当下行动指引，应该高位）

**Verify:** Dashboard 渲染正确，Daily Quests 卡片可见，toast 可触发。

**Commit:** `feat(day7): Dashboard wires DailyQuestsCard + AchievementUnlockToast`

---

## Phase 6 — i18n + smoke + ship（3 task）

### Task 26: i18n keys 添加

读 `src/lib/i18n.ts`，添加：

```ts
// === Day 7: achievements + quests ===
'sidebar.achievements': { zh: '成就', en: 'Achievements' },

'achievements.section': { zh: '长期目标', en: 'Long-term Goals' },
'achievements.title': { zh: '成就', en: 'Achievements' },
'achievements.summary_suffix': { zh: '解锁', en: 'unlocked' },
'achievements.claimable_suffix': { zh: '可领取', en: 'claimable' },
'achievements.category.workout': { zh: '运动', en: 'Workout' },
'achievements.category.streak': { zh: '连击', en: 'Streak' },
'achievements.category.cards': { zh: '卡牌', en: 'Cards' },
'achievements.category.arena': { zh: 'Arena', en: 'Arena' },
'achievements.category.special': { zh: '特殊', en: 'Special' },
'achievements.claim_button': { zh: '领取奖励', en: 'Claim' },
'achievements.claimed_label': { zh: '已领取', en: 'Claimed' },
'achievements.reward.protect': { zh: '+1 保护卡', en: '+1 Protect' },
'achievements.reward.card': { zh: '+1 卡牌', en: '+1 Card' },
'achievements.reward.badge_only': { zh: '徽章', en: 'Badge' },

'dashboard.daily_quests.title': { zh: '今日任务', en: 'Daily Quests' },
'dashboard.daily_quests.completed_label': { zh: '完成', en: 'completed' },
'dashboard.daily_quests.claim_button': { zh: '领取', en: 'Claim' },
'dashboard.daily_quests.claimed_label': { zh: '已领取', en: 'Claimed' },
'dashboard.daily_quests.bonus_label': { zh: '全部完成 BONUS', en: 'ALL CLEAR BONUS' },
'dashboard.daily_quests.bonus_card': { zh: '随机卡', en: 'random card' },
'dashboard.daily_quests.bonus_claim': { zh: '领取', en: 'Claim' },
'dashboard.daily_quests.bonus_claimed': { zh: '已领取', en: 'Claimed' },
'dashboard.daily_quests.bonus_locked': { zh: '未解锁', en: 'Locked' },

'toast.achievement_unlocked': { zh: '解锁成就', en: 'Unlocked' },
'toast.achievement_unlocked_cta': { zh: '前往领取', en: 'View' },
```

**Verify:**
- `bun run test` 全过（i18n 测试，如有，对 keys 总数变化敏感）
- `bunx tsc --noEmit` 干净
- 浏览器切换 zh/en 文案都正常

**Commit:** `feat(day7): i18n keys for achievements + quests (22 × 2 lang)`

---

### Task 27: 端到端 smoke + bug fix

手动 smoke 列表（通过 Dev Drawer 加速）：

1. **首次访问 `/achievements`**：18 条全部显示，进度全 0
2. **运动一次**：dashboard 任务"完成 1 次运动" 进度 1/1，按钮亮 → 点击 → +50 XP 入账
3. **`/achievements` 检查**：`workout_001` 解锁，按钮可点 → 点 → +50 XP
4. **Dev Drawer set_streak 30**：Achievements 中 `streak_03/07/30` 全亮可领，dashboard 顶 toast 出现
5. **Dev Drawer level_up**：lifetime_xp 跳，所有 xp 类奖励发放后能直接看到反馈
6. **3 个 quest 全 claim**：bonus 行亮起 → 点 → +200 XP + 1 张随机 common 卡入 deck
7. **Dev Drawer reset_progress**：全部成就 + 任务进度清零（验证 update_progress 不破坏 dev_dispatch reset）

**注意：** Dev Drawer 的 reset_progress 当前不清 user_achievements/daily_quests。在本 task 中扩展 dev_dispatch 让 `reset_progress` 也 truncate 这两表（仅当前用户的行）：

修改 migration 12 的同名 SECTION 嵌入修改？不行，dev_dispatch 在 migration 11。
→ 直接在 migration 12 末尾再 `create or replace dev_dispatch` 完整 replace（含 Day 7 扩展），或者新建 migration `20260510000013_dev_dispatch_day7_reset.sql`。

**实施：** 新建 `supabase/migrations/20260510000013_dev_dispatch_day7_reset.sql`：

```sql
-- Day 7 patch: dev_dispatch.reset_progress also clears user_achievements + daily_quests

create or replace function public.dev_dispatch(p_action text, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
-- ... 完整复制 migration 11 中的 dev_dispatch 定义，仅在 'reset_progress' 分支末尾加 ...
-- when 'reset_progress' then
--   ... existing reset logic ...
--   delete from public.user_achievements where user_id = v_user_id;
--   delete from public.daily_quests where user_id = v_user_id;
--   update public.users set last_quest_date = null, last_quest_bonus_date = null where id = v_user_id;
$$;
```

> Implementer 注意：完整读 migration 11 中 dev_dispatch 定义、复制、追加 reset_progress 三行 delete + update。

如果 smoke 暴露 bug，在本 task 内 fix + commit。所有 fix commit 都用 `fix(day7): ...` 前缀。

**Verify:**
- 所有 7 项 smoke 通过
- `bun run test` 全过
- `bunx tsc --noEmit` 干净
- `bun run build` 成功

**Commit(s):**
- `feat(day7): extend dev_dispatch reset_progress to clear achievements + quests`
- 0+ 个 `fix(day7): ...` per bug

---

### Task 28: ship checklist + 最终 commit

执行最终验收：

- [ ] tsc 干净
- [ ] tests 全过（>= 50，新增 achievements/group + quests/random 共 7 个 unit test）
- [ ] build 成功
- [ ] migration 12 + 13 已 push 到 supabase
- [ ] Sidebar 加 "成就" item 可见
- [ ] Dashboard 加 DailyQuestsCard，可领奖
- [ ] `/achievements` 渲染 18 条，可领奖
- [ ] 解锁 toast 跨页 stable（不会重复弹）
- [ ] 跨日切换：手动 update users set last_quest_date = current_date - 1，重新 fetch 看到 3 个新任务

如果 plan 任何一项不通过：回到对应 task 修，commit 标 `fix(day7): ...`。

**最终 commit（如果有）：**
- `chore(day7): final checklist passes — ship`

---

## Subagent Dispatch 注意事项

按 Day 6 实践，每 task 走一轮：
1. **Implementer** 用 implementer-prompt.md 模板，把 task 完整 paste 进 prompt
2. **Spec reviewer** 用 spec-reviewer-prompt.md，对比 task 文本和实际 commit
3. **Code reviewer** 用 code-quality-reviewer-prompt.md（spec 通过后），审 diff 质量

如果 reviewer 发现 Critical 问题：fix 后重 review。如果是 Minor：记录到本 plan 末尾的 "Known Issues" 节、不阻塞下一 task。

每 task 一个 commit。Phase 之间不需要硬同步点，但 Phase 1 (migration) 必须先全部 done + push 后，Phase 3+ 的 hook 测试才有真实 backend 可打。Phase 2 (helpers) 只依赖 types，可与 Phase 1 部分并行。

---

## Risk Register

| 风险 | 缓解 |
|---|---|
| migration 12 push 再次卡 IPv4 | CLAUDE.md gotchas 节有 pooler URL workaround |
| submit_workout / end_battle / revive_streak 变量名跟 spec 不一致 | Task 10 implementer 必须读 migration 11 实际定义、用实际变量名替换。如果 v_card_is_new 不存在，在 SECTION 10 中扩展计算逻辑 |
| dev_dispatch 在 migration 11 已定义、Day 7 修改产生重复 | Task 27 用 migration 13 完整 `create or replace` |
| RLS 阻止 update_progress 内部 update user_achievements / daily_quests | update_progress 是 security definer，绕过 RLS |
| anon 用户首次访问 /achievements 时 user_achievements 表空 | get_achievements 会自动 insert 缺失行 |
| 任务模板池 active=true 全部禁用某难度 | get_daily_quests fallback 跳过该 slot（仅生成 2 个 quest）— spec 7 节已注 |

---

## Known Issues（开发期间填）

(none)
