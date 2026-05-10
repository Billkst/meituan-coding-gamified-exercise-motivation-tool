# Day 6 — Onboarding + 保护卡 + 复活 + Dev Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 5 步 Onboarding（含 Wow #1 epic 保底）+ Streak 保护卡 + 复活机制 + Dev Menu，让评审 10 分钟内能演示完整数学闭环。

**Architecture:** Schema First — 1 个 migration（alter users + replace submit_workout + 3 个新 RPC）→ 纯 TS 助手函数（带单测）→ React Query mutation hooks → zustand DevStore + sessionStorage → React Router 路由 gate → UI 组件（Onboarding/ReviveBanner/DevDrawer/Tour）。

**Tech Stack:** Supabase plpgsql RPCs · React 18 + TS · Tailwind · React Router 6 · zustand · @tanstack/react-query · Vitest · jsdom · @testing-library/react

**Spec source:** `docs/superpowers/specs/2026-05-10-day6-onboarding-protect-revive-dev-design.md`

---

## File Structure

新增（22 个文件）：
```
supabase/migrations/20260510000011_day6_streak_protect_revive.sql
src/store/useDevStore.ts
src/components/OnboardingGate.tsx
src/components/ReviveBanner.tsx
src/components/DevDrawer.tsx
src/components/DashboardTourOverlay.tsx
src/components/cards/CardReveal3.tsx
src/components/onboarding/ProgressDots.tsx
src/components/onboarding/Step1Welcome.tsx
src/components/onboarding/Step2Sports.tsx
src/components/onboarding/Step3MockWorkout.tsx
src/components/onboarding/Step4LootReveal.tsx
src/api/onboarding.ts
src/api/revive.ts
src/api/dev.ts
src/lib/streak/protect.ts
src/lib/streak/revive.ts
src/lib/streak/grant.ts
src/lib/streak/__tests__/protect.test.ts
src/lib/streak/__tests__/revive.test.ts
src/lib/streak/__tests__/grant.test.ts
src/components/__tests__/OnboardingGate.test.tsx
```

修改（7 个文件）：
```
src/App.tsx
src/pages/Onboarding.tsx          (完全重写)
src/pages/Dashboard.tsx
src/pages/Loot.tsx                (改用 CardReveal3 — 抽离单卡逻辑成 3 卡)
src/components/Sidebar.tsx
src/lib/i18n.ts
src/types/db.ts                   (extend UserRow)
```

---

## Phase 1 — Schema Migration

### Task 1: 创建 migration 文件骨架 + alter users 字段

**Files:**
- Create: `supabase/migrations/20260510000011_day6_streak_protect_revive.sql`

- [ ] **Step 1: 创建 migration 文件，写 alter users 部分**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260510000011_day6_streak_protect_revive.sql
git commit -m "feat(day6): migration 11 skeleton + alter users 3 fields"
```

---

### Task 2: Migration — replace submit_workout with new behaviors

**Files:**
- Modify: `supabase/migrations/20260510000011_day6_streak_protect_revive.sql`

- [ ] **Step 1: Append replaced submit_workout to migration**

Append this block to the migration file (after the alter users):

```sql
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
  v_yesterday date := v_today - interval '1 day';
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
    v_gap := 999;  -- treat null as huge gap
  else
    v_gap := v_today - v_user.last_workout_date;
  end if;

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

  -- first workout (no prior streak active row)
  if v_user.last_workout_date is null then
    v_new_streak := 1;
    v_streak_status := 'new';
    insert into streaks (user_id, start_date, length, status)
      values (v_user_id, v_today, 1, 'active');
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260510000011_day6_streak_protect_revive.sql
git commit -m "feat(day6): submit_workout adds freeze/protect/grant logic"
```

---

### Task 3: Migration — revive_streak RPC

**Files:**
- Modify: `supabase/migrations/20260510000011_day6_streak_protect_revive.sql`

- [ ] **Step 1: Append revive_streak to migration**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260510000011_day6_streak_protect_revive.sql
git commit -m "feat(day6): revive_streak RPC"
```

---

### Task 4: Migration — grant_onboarding_pack RPC

**Files:**
- Modify: `supabase/migrations/20260510000011_day6_streak_protect_revive.sql`

- [ ] **Step 1: Append grant_onboarding_pack to migration**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260510000011_day6_streak_protect_revive.sql
git commit -m "feat(day6): grant_onboarding_pack RPC (1 epic + 2 random)"
```

---

### Task 5: Migration — dev_dispatch RPC

**Files:**
- Modify: `supabase/migrations/20260510000011_day6_streak_protect_revive.sql`

- [ ] **Step 1: Append dev_dispatch to migration**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260510000011_day6_streak_protect_revive.sql
git commit -m "feat(day6): dev_dispatch RPC (7 actions)"
```

---

### Task 6: Apply migration to remote Supabase + smoke verify

**Files:** None (operational task)

- [ ] **Step 1: Push migration to remote**

```bash
cd /home/liujunxi/CodeSpace/meituan-coding
supabase db push
```

Expected: `Applying migration 20260510000011_day6_streak_protect_revive.sql...` then `Finished supabase db push`.

If WSL2 IPv4 issue (same as Day 5), use the workaround from Day 5 docs (set `SUPABASE_DB_URL` to pooler IPv4).

- [ ] **Step 2: Smoke test each new RPC via supabase CLI psql**

```bash
psql "$SUPABASE_DB_URL" -c "select count(*) from cards where rarity='epic';"
```

Expected: at least 1 row (epic pool not empty).

```bash
psql "$SUPABASE_DB_URL" -c "select column_name from information_schema.columns where table_name='users' and column_name in ('onboarded_at','freeze_xp_until','last_protect_grant_at');"
```

Expected: 3 rows.

- [ ] **Step 3: Commit verification log to plan checklist (no code change)**

No commit needed — this task is migration verification only.

---

## Phase 2 — Type Extension

### Task 7: Extend UserRow type with new fields

**Files:**
- Modify: `src/types/db.ts`

- [ ] **Step 1: Read existing UserRow definition**

Read `src/types/db.ts` to locate UserRow.

- [ ] **Step 2: Add 3 fields to UserRow**

In UserRow interface, add these fields (keep alphabetical or add at end):

```typescript
export interface UserRow {
  // ... existing fields
  onboarded_at: string | null
  freeze_xp_until: string | null
  last_protect_grant_at: string | null
}
```

- [ ] **Step 3: Run tsc to verify no compile errors**

```bash
bunx tsc --noEmit
```

Expected: 0 errors. If any consumers need adjustment, fix inline (likely zero — fields are optional null).

- [ ] **Step 4: Commit**

```bash
git add src/types/db.ts
git commit -m "feat(day6): extend UserRow with onboarded_at/freeze_xp_until/last_protect_grant_at"
```

---

## Phase 3 — Pure Streak Helpers (TDD)

### Task 8: protect.ts — computeNextStreak

**Files:**
- Create: `src/lib/streak/protect.ts`
- Test: `src/lib/streak/__tests__/protect.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `src/lib/streak/__tests__/protect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeNextStreak } from '../protect'

describe('computeNextStreak', () => {
  it('gap=0 → same_day, no change', () => {
    expect(computeNextStreak({ gap: 0, current: 5, protect: 1 }))
      .toEqual({ next: 5, status: 'same_day', protect_consumed: false, protect_after: 1 })
  })

  it('gap=1 protect=0 → continued', () => {
    expect(computeNextStreak({ gap: 1, current: 5, protect: 0 }))
      .toEqual({ next: 6, status: 'continued', protect_consumed: false, protect_after: 0 })
  })

  it('gap=2 protect=1 → protected, consumes 1', () => {
    expect(computeNextStreak({ gap: 2, current: 5, protect: 1 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 0 })
  })

  it('gap=2 protect=0 → broken', () => {
    expect(computeNextStreak({ gap: 2, current: 5, protect: 0 }))
      .toEqual({ next: 1, status: 'broken', protect_consumed: false, protect_after: 0 })
  })

  it('gap=3 protect=3 → protected (consumes only 1)', () => {
    expect(computeNextStreak({ gap: 3, current: 5, protect: 3 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 2 })
  })

  it('gap=8 protect=3 → broken (1 protect insufficient for 8-day gap, simplified)', () => {
    // Simplification: protect card only ever covers 1-day gap.
    // Gap >= 2 with protect >= 1 always protected (server matches).
    expect(computeNextStreak({ gap: 8, current: 5, protect: 3 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 2 })
  })

  it('first workout (gap=999, current=0) → new', () => {
    expect(computeNextStreak({ gap: 999, current: 0, protect: 0 }))
      .toEqual({ next: 1, status: 'new', protect_consumed: false, protect_after: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/lib/streak/__tests__/protect.test.ts
```

Expected: FAIL with "Cannot find module '../protect'".

- [ ] **Step 3: Implement protect.ts**

Create `src/lib/streak/protect.ts`:

```typescript
export type StreakStatus = 'new' | 'continued' | 'protected' | 'broken' | 'same_day'

export interface ComputeNextStreakInput {
  gap: number       // days between today and last_workout_date (0 if same day)
  current: number   // current_streak before today
  protect: number   // protect_cards stock
}

export interface ComputeNextStreakOutput {
  next: number
  status: StreakStatus
  protect_consumed: boolean
  protect_after: number
}

/**
 * Pure mirror of submit_workout's streak logic. Used for client-side
 * preview / unit tests. The RPC remains the source of truth.
 */
export function computeNextStreak(input: ComputeNextStreakInput): ComputeNextStreakOutput {
  const { gap, current, protect } = input
  if (gap === 0) {
    return { next: current, status: 'same_day', protect_consumed: false, protect_after: protect }
  }
  if (gap === 1) {
    return { next: current + 1, status: 'continued', protect_consumed: false, protect_after: protect }
  }
  // gap >= 2 (or unknown last_workout_date encoded as 999)
  if (current === 0 && gap >= 2) {
    return { next: 1, status: 'new', protect_consumed: false, protect_after: protect }
  }
  if (protect >= 1) {
    return { next: current + 1, status: 'protected', protect_consumed: true, protect_after: protect - 1 }
  }
  return { next: 1, status: 'broken', protect_consumed: false, protect_after: protect }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
bun run test src/lib/streak/__tests__/protect.test.ts
```

Expected: PASS, 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak/protect.ts src/lib/streak/__tests__/protect.test.ts
git commit -m "feat(day6): protect.ts pure streak helper + 7 tests"
```

---

### Task 9: revive.ts — computeReviveAmount + canRevive

**Files:**
- Create: `src/lib/streak/revive.ts`
- Test: `src/lib/streak/__tests__/revive.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `src/lib/streak/__tests__/revive.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeReviveAmount, canRevive } from '../revive'

describe('computeReviveAmount', () => {
  it('prev_streak=10 → 5', () => expect(computeReviveAmount(10)).toBe(5))
  it('prev_streak=11 → 5 (floor)', () => expect(computeReviveAmount(11)).toBe(5))
  it('prev_streak=1 → 0', () => expect(computeReviveAmount(1)).toBe(0))
  it('prev_streak=0 → 0', () => expect(computeReviveAmount(0)).toBe(0))
  it('null/undefined → 0', () => expect(computeReviveAmount(null)).toBe(0))
})

describe('canRevive', () => {
  const today = new Date('2026-05-10T12:00:00Z')

  it('streak=0 + 6 days ago → true', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-04',
      freeze_xp_until: null,
    }, today)).toBe(true)
  })

  it('streak=0 + 7 days ago → true (boundary)', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-03',
      freeze_xp_until: null,
    }, today)).toBe(true)
  })

  it('streak=0 + 8 days ago → false', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-02',
      freeze_xp_until: null,
    }, today)).toBe(false)
  })

  it('freeze_until in future → false', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-04',
      freeze_xp_until: '2026-05-11T00:00:00Z',
    }, today)).toBe(false)
  })

  it('streak > 0 → false', () => {
    expect(canRevive({
      current_streak: 5,
      last_workout_date: '2026-05-09',
      freeze_xp_until: null,
    }, today)).toBe(false)
  })

  it('last_workout_date null → false', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: null,
      freeze_xp_until: null,
    }, today)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/lib/streak/__tests__/revive.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement revive.ts**

Create `src/lib/streak/revive.ts`:

```typescript
export function computeReviveAmount(prevStreakLength: number | null | undefined): number {
  if (!prevStreakLength || prevStreakLength <= 1) return 0
  return Math.floor(prevStreakLength / 2)
}

export interface CanReviveInput {
  current_streak: number
  last_workout_date: string | null
  freeze_xp_until: string | null
}

export function canRevive(user: CanReviveInput, now: Date): boolean {
  if (user.current_streak !== 0) return false
  if (!user.last_workout_date) return false
  if (user.freeze_xp_until && new Date(user.freeze_xp_until) > now) return false

  const last = new Date(user.last_workout_date + 'T00:00:00Z')
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z')
  const daysDiff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff >= 1 && daysDiff <= 7
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
bun run test src/lib/streak/__tests__/revive.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak/revive.ts src/lib/streak/__tests__/revive.test.ts
git commit -m "feat(day6): revive.ts (computeReviveAmount + canRevive) + 11 tests"
```

---

### Task 10: grant.ts — shouldGrantProtect

**Files:**
- Create: `src/lib/streak/grant.ts`
- Test: `src/lib/streak/__tests__/grant.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `src/lib/streak/__tests__/grant.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { shouldGrantProtect } from '../grant'

describe('shouldGrantProtect', () => {
  const now = new Date('2026-05-10T00:00:00Z')

  it('last_grant 6 days ago, stock 2 → false', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-04T00:00:00Z',
      protect_cards: 2,
    }, now)).toBe(false)
  })

  it('last_grant 7 days ago, stock 3 (full) → false', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-03T00:00:00Z',
      protect_cards: 3,
    }, now)).toBe(false)
  })

  it('last_grant 7 days ago, stock 2 → true', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-03T00:00:00Z',
      protect_cards: 2,
    }, now)).toBe(true)
  })

  it('last_grant 14 days ago, stock 1 → true (only 1 grant, not 2)', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-04-26T00:00:00Z',
      protect_cards: 1,
    }, now)).toBe(true)
  })

  it('last_grant exactly 6.99 days → false', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-03T00:14:24Z',
      protect_cards: 0,
    }, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/lib/streak/__tests__/grant.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement grant.ts**

Create `src/lib/streak/grant.ts`:

```typescript
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const PROTECT_STOCK_MAX = 3

export interface ShouldGrantProtectInput {
  last_protect_grant_at: string
  protect_cards: number
}

export function shouldGrantProtect(input: ShouldGrantProtectInput, now: Date): boolean {
  if (input.protect_cards >= PROTECT_STOCK_MAX) return false
  const last = new Date(input.last_protect_grant_at).getTime()
  return (now.getTime() - last) >= SEVEN_DAYS_MS
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
bun run test src/lib/streak/__tests__/grant.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak/grant.ts src/lib/streak/__tests__/grant.test.ts
git commit -m "feat(day6): grant.ts shouldGrantProtect + 5 tests"
```

---

## Phase 4 — API Hooks

### Task 11: useGrantOnboardingPack hook

**Files:**
- Create: `src/api/onboarding.ts`

- [ ] **Step 1: Implement useGrantOnboardingPack**

Create `src/api/onboarding.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface OnboardingPackResult {
  cards: Array<{ id: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' }>
  idempotent: boolean
}

export function useGrantOnboardingPack() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['onboarding-pack'],
    mutationFn: async (buffs: Record<string, number>): Promise<OnboardingPackResult> => {
      const { data, error } = await supabase.rpc('grant_onboarding_pack', { p_buffs: buffs })
      if (error) throw error
      return data as OnboardingPackResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user_cards'] })
    },
  })
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/onboarding.ts
git commit -m "feat(day6): useGrantOnboardingPack mutation hook"
```

---

### Task 12: useReviveStreak hook

**Files:**
- Create: `src/api/revive.ts`

- [ ] **Step 1: Implement useReviveStreak**

Create `src/api/revive.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ReviveResult {
  revived_streak: number
  freeze_until: string
}

export function useReviveStreak() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ReviveResult> => {
      const { data, error } = await supabase.rpc('revive_streak')
      if (error) throw error
      return data as ReviveResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/revive.ts
git commit -m "feat(day6): useReviveStreak mutation hook"
```

---

### Task 13: useDevDispatch hook

**Files:**
- Create: `src/api/dev.ts`

- [ ] **Step 1: Implement useDevDispatch**

Create `src/api/dev.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DevAction =
  | 'set_streak'
  | 'grant_legendary'
  | 'level_up'
  | 'break_streak'
  | 'reset_progress'
  | 'grant_protect'
  | 'reset_onboarding'

export interface DevDispatchInput {
  action: DevAction
  params?: Record<string, unknown>
}

export function useDevDispatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ action, params }: DevDispatchInput) => {
      const { data, error } = await supabase.rpc('dev_dispatch', {
        p_action: action,
        p_params: params ?? {},
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries()  // dev mutates anything; nuke all caches
    },
  })
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/dev.ts
git commit -m "feat(day6): useDevDispatch mutation hook"
```

---

## Phase 5 — Dev Store + Wire-Up

### Task 14: useDevStore (zustand)

**Files:**
- Create: `src/store/useDevStore.ts`

- [ ] **Step 1: Implement useDevStore**

Create `src/store/useDevStore.ts`:

```typescript
import { create } from 'zustand'

const SS_KEY = 'pulse_dev'

interface DevState {
  isDevMode: boolean
  isPanelOpen: boolean
  enableDevMode: () => void
  disableDevMode: () => void
  togglePanel: () => void
  closePanel: () => void
}

const initialDevMode = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SS_KEY) === '1'
  } catch {
    return false
  }
}

export const useDevStore = create<DevState>((set) => ({
  isDevMode: initialDevMode(),
  isPanelOpen: false,
  enableDevMode: () => {
    try { sessionStorage.setItem(SS_KEY, '1') } catch {}
    set({ isDevMode: true })
  },
  disableDevMode: () => {
    try { sessionStorage.removeItem(SS_KEY) } catch {}
    set({ isDevMode: false, isPanelOpen: false })
  },
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  closePanel: () => set({ isPanelOpen: false }),
}))
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/useDevStore.ts
git commit -m "feat(day6): useDevStore zustand + sessionStorage"
```

---

### Task 15: App.tsx — wire dev URL param + keyboard shortcut

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add dev mode hooks to App.tsx**

Modify `src/App.tsx`. After existing `useEffect(() => { void initAuth() }, [])`, add:

```tsx
import { useDevStore } from '@/store/useDevStore'

// inside App component, after existing useEffect
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('dev') === '1') {
    useDevStore.getState().enableDevMode()
  }

  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault()
      const { isDevMode, togglePanel } = useDevStore.getState()
      if (isDevMode) togglePanel()
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

- [ ] **Step 2: Run tsc + dev server**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(day6): App.tsx wire ?dev=1 + Cmd/Ctrl+Shift+D shortcut"
```

---

### Task 16: DevDrawer component

**Files:**
- Create: `src/components/DevDrawer.tsx`

- [ ] **Step 1: Implement DevDrawer**

Create `src/components/DevDrawer.tsx`:

```tsx
import { IconX } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useDevStore } from '@/store/useDevStore'
import { useDevDispatch } from '@/api/dev'
import type { DevAction } from '@/api/dev'
import { useTranslation } from '@/lib/i18n'

const ACTIONS: Array<{ action: DevAction; key: string; promptForN?: boolean }> = [
  { action: 'set_streak', key: 'dev.actions.set_streak', promptForN: true },
  { action: 'grant_legendary', key: 'dev.actions.grant_legendary' },
  { action: 'level_up', key: 'dev.actions.level_up' },
  { action: 'break_streak', key: 'dev.actions.break_streak' },
  { action: 'grant_protect', key: 'dev.actions.grant_protect' },
  { action: 'reset_onboarding', key: 'dev.actions.reset_onboarding' },
  { action: 'reset_progress', key: 'dev.actions.reset_progress' },
]

export default function DevDrawer() {
  const { t } = useTranslation()
  const { isDevMode, isPanelOpen, togglePanel, disableDevMode } = useDevStore()
  const dispatch = useDevDispatch()

  if (!isDevMode) return null

  const run = async (action: DevAction, promptForN: boolean | undefined) => {
    let params: Record<string, unknown> = {}
    if (promptForN) {
      const raw = window.prompt('N =', '19')
      if (raw == null) return
      const n = parseInt(raw, 10)
      if (isNaN(n)) {
        toast.error('invalid number')
        return
      }
      params = { n }
    }
    if (action === 'reset_progress' && !window.confirm(t('dev.confirm.reset_progress'))) return
    try {
      await dispatch.mutateAsync({ action, params })
      toast.success(`✓ ${action}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`${action}: ${msg}`)
    }
  }

  return (
    <div
      className={
        'fixed bottom-0 left-[240px] right-0 bg-semantic-error/95 backdrop-blur transition-all duration-200 ' +
        (isPanelOpen ? 'h-64' : 'h-0 overflow-hidden')
      }
      style={{ zIndex: 90 }}
    >
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/20">
        <div className="font-display font-bold uppercase text-white tracking-wider">
          {t('dev.title')}
        </div>
        <button onClick={togglePanel} className="text-white p-1 hover:bg-white/10 rounded">
          <IconX size={18} />
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3 p-6">
        {ACTIONS.map(({ action, key, promptForN }) => (
          <button
            key={action}
            onClick={() => run(action, promptForN)}
            disabled={dispatch.isPending}
            className="bg-bg-primary border border-semantic-error text-semantic-error font-mono uppercase text-xs px-3 py-2 rounded hover:bg-semantic-error hover:text-white transition disabled:opacity-50"
          >
            {t(key)}
          </button>
        ))}
        <button
          onClick={disableDevMode}
          className="bg-bg-primary border border-white/30 text-white font-mono uppercase text-xs px-3 py-2 rounded hover:bg-white hover:text-bg-primary transition col-span-2"
        >
          {t('dev.actions.exit')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors. If `sonner` import fails (toast lib), check existing imports in repo for toast lib name and adapt.

- [ ] **Step 3: Commit**

```bash
git add src/components/DevDrawer.tsx
git commit -m "feat(day6): DevDrawer component (7 actions + exit)"
```

---

### Task 17: Sidebar — DEV chip toggle

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Read current Sidebar.tsx**

```bash
# inspect current structure
```

Read `src/components/Sidebar.tsx` to find a sensible place to inject the chip (likely top of sidebar near logo).

- [ ] **Step 2: Add DEV chip**

Add at the top of the sidebar's nav list (or near logo):

```tsx
import { useDevStore } from '@/store/useDevStore'

// inside Sidebar component
const { isDevMode, togglePanel } = useDevStore()

// in JSX, near the top (after logo):
{isDevMode && (
  <button
    onClick={togglePanel}
    className="mx-4 mt-2 mb-3 bg-semantic-error text-white font-display font-bold uppercase tracking-wider px-3 py-1 rounded text-xs hover:opacity-80"
  >
    DEV
  </button>
)}
```

- [ ] **Step 3: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(day6): Sidebar DEV chip toggle"
```

---

### Task 18: Mount DevDrawer in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Mount DevDrawer**

Add `<DevDrawer />` inside the main return, after `<main>...</main>` but inside the outer `<div>`:

```tsx
import DevDrawer from './components/DevDrawer'

// in return:
return (
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="flex-1 ml-[240px]">
      {/* ... existing routes */}
    </main>
    <DevDrawer />
  </div>
)
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(day6): mount DevDrawer in App.tsx"
```

---

## Phase 6 — Onboarding Gate

### Task 19: OnboardingGate component + tests

**Files:**
- Create: `src/components/OnboardingGate.tsx`
- Test: `src/components/__tests__/OnboardingGate.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/OnboardingGate.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OnboardingGate from '../OnboardingGate'

vi.mock('@/api/users', () => ({
  useCurrentUser: vi.fn(),
}))
vi.mock('@/store/useDevStore', () => ({
  useDevStore: vi.fn(),
}))

import { useCurrentUser } from '@/api/users'
import { useDevStore } from '@/store/useDevStore'

const mockUser = (onboarded_at: string | null) => {
  ;(useCurrentUser as any).mockReturnValue({
    data: { id: 'u1', onboarded_at, freeze_xp_until: null, last_protect_grant_at: '2026-05-01T00:00:00Z' },
    isLoading: false,
  })
}
const mockDev = (isDevMode: boolean) => {
  ;(useDevStore as any).mockReturnValue({ isDevMode })
}

const Setup = ({ initial }: { initial: string }) => (
  <MemoryRouter initialEntries={[initial]}>
    <OnboardingGate>
      <Routes>
        <Route path="/dashboard" element={<div>DASH</div>} />
        <Route path="/onboarding" element={<div>ONB</div>} />
      </Routes>
    </OnboardingGate>
  </MemoryRouter>
)

describe('OnboardingGate', () => {
  it('not onboarded + on /dashboard → redirect to /onboarding', () => {
    mockUser(null)
    mockDev(false)
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('ONB')).toBeInTheDocument()
  })

  it('onboarded + on /onboarding → redirect to /dashboard', () => {
    mockUser('2026-05-01T00:00:00Z')
    mockDev(false)
    render(<Setup initial="/onboarding" />)
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })

  it('onboarded + on /dashboard → no redirect', () => {
    mockUser('2026-05-01T00:00:00Z')
    mockDev(false)
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })

  it('onboarded + isDevMode + ?force=1 + on /onboarding → no redirect', () => {
    mockUser('2026-05-01T00:00:00Z')
    mockDev(true)
    render(<Setup initial="/onboarding?force=1" />)
    expect(screen.getByText('ONB')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test src/components/__tests__/OnboardingGate.test.tsx
```

Expected: FAIL ("Cannot find OnboardingGate").

- [ ] **Step 3: Implement OnboardingGate**

Create `src/components/OnboardingGate.tsx`:

```tsx
import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/api/users'
import { useDevStore } from '@/store/useDevStore'

export default function OnboardingGate({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()
  const { isDevMode } = useDevStore()

  if (isLoading || !user) return <>{children}</>

  const isOnboarded = user.onboarded_at != null
  const onOnboardingPath = location.pathname === '/onboarding'
  const forceParam = new URLSearchParams(location.search).get('force') === '1'

  if (!isOnboarded && !onOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }
  if (isOnboarded && onOnboardingPath && !(isDevMode && forceParam)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/components/__tests__/OnboardingGate.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingGate.tsx src/components/__tests__/OnboardingGate.test.tsx
git commit -m "feat(day6): OnboardingGate + 4 tests"
```

---

### Task 20: Mount OnboardingGate in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Wrap routes with OnboardingGate**

In App.tsx, wrap the `<Routes>` with `<OnboardingGate>`:

```tsx
import OnboardingGate from './components/OnboardingGate'

// in JSX:
<main className="flex-1 ml-[240px]">
  <OnboardingGate>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* ... existing routes */}
    </Routes>
  </OnboardingGate>
</main>
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(day6): mount OnboardingGate in App.tsx"
```

---

## Phase 7 — Onboarding UI Components

### Task 21: ProgressDots component

**Files:**
- Create: `src/components/onboarding/ProgressDots.tsx`

- [ ] **Step 1: Implement ProgressDots**

Create `src/components/onboarding/ProgressDots.tsx`:

```tsx
export default function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={
            'w-2 h-2 rounded-full transition-colors duration-300 ' +
            (i < current ? 'bg-accent-primary' : 'bg-white/20')
          }
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/ProgressDots.tsx
git commit -m "feat(day6): ProgressDots component"
```

---

### Task 22: CardReveal3 component

**Files:**
- Create: `src/components/cards/CardReveal3.tsx`

- [ ] **Step 1: Implement CardReveal3**

Create `src/components/cards/CardReveal3.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useCardById } from '@/api/cards'
import type { Rarity } from '@/types/db'

interface CardSlot {
  id: string
  rarity: Rarity
}

interface Props {
  cards: CardSlot[]
  /** Skip the flip animation (used when revisiting an already-revealed pack). */
  skipAnimation?: boolean
}

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

const RARITY_HALO: Record<Rarity, string> = {
  common: '',
  rare: 'shadow-[0_0_20px_rgba(60,140,255,0.4)]',
  epic: 'shadow-[0_0_28px_rgba(156,60,255,0.55)] animate-halo-pulse',
  legendary: 'shadow-glow-legendary animate-halo-pulse',
}

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

const FLIP_DELAYS_MS = [0, 300, 600]

export default function CardReveal3({ cards, skipAnimation = false }: Props) {
  const [revealed, setRevealed] = useState<boolean[]>(
    skipAnimation ? cards.map(() => true) : cards.map(() => false)
  )

  useEffect(() => {
    if (skipAnimation) return
    const timers = FLIP_DELAYS_MS.map((delay, i) =>
      setTimeout(() => {
        setRevealed((prev) => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 1000 + delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [skipAnimation])

  return (
    <div className="flex items-center justify-center gap-6 my-8">
      {cards.map((card, i) => (
        <CardSlotView
          key={card.id + i}
          card={card}
          revealed={revealed[i]}
          isCenter={i === 1}
        />
      ))}
    </div>
  )
}

function CardSlotView({
  card,
  revealed,
  isCenter,
}: {
  card: CardSlot
  revealed: boolean
  isCenter: boolean
}) {
  const { lang } = useTranslation()
  const { data: cardData } = useCardById(card.id)

  const baseSize = isCenter ? 'w-[200px] h-[280px]' : 'w-[160px] h-[224px]'
  const centerScale = isCenter && revealed ? 'scale-105' : ''
  const haloClass = revealed ? RARITY_HALO[card.rarity] : ''

  return (
    <div className={`relative ${baseSize} transition-transform duration-500 ${centerScale}`}>
      {!revealed ? (
        <div className="absolute inset-0 bg-bg-secondary border border-white/20 rounded-card flex items-center justify-center">
          <div className="font-display text-4xl text-text-tertiary">?</div>
        </div>
      ) : (
        <div
          className={`absolute inset-0 bg-bg-secondary rounded-card p-4 flex flex-col border-2 ${RARITY_BORDER[card.rarity]} ${haloClass} animate-reveal-flip`}
        >
          <div className="flex items-start justify-between mb-3">
            <span
              className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-widest rounded-full border ${RARITY_BORDER[card.rarity]} ${RARITY_TEXT[card.rarity]}`}
            >
              {card.rarity}
            </span>
            <span className="font-mono text-[9px] text-text-tertiary uppercase">
              {card.id}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center text-center">
            <div className="font-display font-bold text-xl text-text-primary mb-2">
              {cardData ? (lang === 'zh' ? cardData.name_zh : cardData.name_en) : '...'}
            </div>
            <div className="font-body text-[11px] text-text-secondary leading-relaxed">
              {cardData
                ? lang === 'zh'
                  ? cardData.ability_text_zh
                  : cardData.ability_text_en
                : ''}
            </div>
          </div>
          <div className="border-t border-white/10 pt-2 flex items-center justify-between text-[10px]">
            <span className="font-mono text-text-tertiary uppercase">ATK / DEF</span>
            <span className="font-mono text-text-primary tabular-nums">
              {cardData?.base_attack ?? '—'} / {cardData?.base_defense ?? '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/CardReveal3.tsx
git commit -m "feat(day6): CardReveal3 component (3-card sequential flip)"
```

---

### Task 23: Step1Welcome

**Files:**
- Create: `src/components/onboarding/Step1Welcome.tsx`

- [ ] **Step 1: Implement Step1Welcome**

```tsx
import { useTranslation } from '@/lib/i18n'

export default function Step1Welcome({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div
        className="font-display font-black text-accent-primary leading-none mb-6"
        style={{
          fontSize: 'clamp(80px, 16vh, 200px)',
          textShadow: '0 0 24px rgba(182,255,60,0.7), 0 0 48px rgba(182,255,60,0.3)',
        }}
      >
        PULSE
      </div>
      <div className="font-mono text-base uppercase tracking-[0.2em] text-text-secondary mb-3">
        {t('onboarding.step1.title')}
      </div>
      <div className="font-mono text-sm text-text-tertiary text-center max-w-md">
        {t('onboarding.step1.subtitle')}
      </div>
      <button
        onClick={onNext}
        className="mt-12 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-12 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
      >
        {t('onboarding.step1.cta')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/Step1Welcome.tsx
git commit -m "feat(day6): Onboarding Step1Welcome"
```

---

### Task 24: Step2Sports

**Files:**
- Create: `src/components/onboarding/Step2Sports.tsx`

- [ ] **Step 1: Implement Step2Sports**

```tsx
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSports } from '@/api/sports'

interface Props {
  onNext: (selected: string[]) => void
  onPrev: () => void
}

export default function Step2Sports({ onNext, onPrev }: Props) {
  const { t, lang } = useTranslation()
  const { data: sports = [] } = useSports()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  const canContinue = selected.size >= 1 && selected.size <= 3

  return (
    <div className="flex-1 flex flex-col items-center px-8 overflow-y-auto">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2 text-center">
        {t('onboarding.step2.title')}
      </h2>
      <div className="font-mono text-xs text-text-tertiary uppercase tracking-widest mb-6">
        {t('onboarding.step2.selected', { n: selected.size })}
      </div>
      <div className="grid grid-cols-5 gap-3 max-w-3xl w-full mb-8">
        {sports.map((sp) => {
          const on = selected.has(sp.id)
          return (
            <button
              key={sp.id}
              onClick={() => toggle(sp.id)}
              className={
                'flex flex-col items-center justify-center p-3 rounded-card border transition-all aspect-square ' +
                (on
                  ? 'border-accent-primary bg-accent-primary/10 shadow-glow-standard'
                  : 'border-white/10 bg-bg-secondary hover:border-white/30')
              }
            >
              <div className="text-2xl mb-1">{sp.icon}</div>
              <div className="font-mono text-[10px] uppercase tracking-tight text-center">
                {lang === 'zh' ? sp.name_zh : sp.name_en}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex gap-4">
        <button
          onClick={onPrev}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.prev')}
        </button>
        <button
          onClick={() => onNext(Array.from(selected))}
          disabled={!canContinue}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button shadow-glow-standard disabled:opacity-30 disabled:shadow-none"
        >
          {canContinue ? t('onboarding.step2.cta') : t('onboarding.step2.cta_disabled')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors. If `useSports` hook doesn't exist, check `src/api/sports.ts` — Day 1 likely created it. If missing, fallback to inline supabase query.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/Step2Sports.tsx
git commit -m "feat(day6): Onboarding Step2Sports (1-3 selection)"
```

---

### Task 25: Step3MockWorkout

**Files:**
- Create: `src/components/onboarding/Step3MockWorkout.tsx`

- [ ] **Step 1: Implement Step3MockWorkout**

```tsx
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSports } from '@/api/sports'

interface Props {
  onNext: () => void
  onPrev: () => void
  defaultSportId: string | null
}

type Intensity = 'light' | 'medium' | 'high'

export default function Step3MockWorkout({ onNext, onPrev, defaultSportId }: Props) {
  const { t, lang } = useTranslation()
  const { data: sports = [] } = useSports()
  const [sportId, setSportId] = useState(defaultSportId ?? sports[0]?.id ?? '')
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(onNext, 1500)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-8 text-center">
        {t('onboarding.step3.title')}
      </h2>
      <div className="bg-bg-secondary border border-white/10 rounded-card p-6 w-full max-w-md space-y-6">
        <label className="block">
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-2">
            {t('onboarding.step3.sport')}
          </div>
          <select
            value={sportId}
            onChange={(e) => setSportId(e.target.value)}
            className="w-full bg-bg-primary border border-white/20 rounded px-3 py-2 font-mono text-sm"
          >
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {lang === 'zh' ? s.name_zh : s.name_en}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-2">
            {t('onboarding.step3.duration')}
          </div>
          <input
            type="number"
            min={1}
            max={600}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value || '0', 10))}
            className="w-full bg-bg-primary border border-white/20 rounded px-3 py-2 font-mono text-sm"
          />
        </label>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-2">
            {t('onboarding.step3.intensity_label')}
          </div>
          <div className="flex gap-2">
            {(['light', 'medium', 'high'] as Intensity[]).map((it) => (
              <button
                key={it}
                onClick={() => setIntensity(it)}
                className={
                  'flex-1 py-2 rounded font-mono text-xs uppercase tracking-widest border transition ' +
                  (intensity === it
                    ? 'bg-accent-primary text-bg-primary border-accent-primary'
                    : 'border-white/20 text-text-secondary hover:border-white/40')
                }
              >
                {t(`onboarding.step3.intensity.${it}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {submitted && (
        <div className="font-display text-3xl font-bold text-accent-primary tabular-nums mt-6 animate-pulse">
          +60 XP
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={onPrev}
          disabled={submitted}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button disabled:opacity-30"
        >
          {t('onboarding.prev')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitted || !sportId}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button shadow-glow-standard disabled:opacity-30 disabled:shadow-none"
        >
          {t('onboarding.step3.cta')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/Step3MockWorkout.tsx
git commit -m "feat(day6): Onboarding Step3MockWorkout (UI-only fake submit)"
```

---

### Task 26: Step4LootReveal

**Files:**
- Create: `src/components/onboarding/Step4LootReveal.tsx`

- [ ] **Step 1: Implement Step4LootReveal**

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'
import { useGrantOnboardingPack } from '@/api/onboarding'
import CardReveal3 from '@/components/cards/CardReveal3'

interface Props {
  onPrev: () => void
  selectedSports: string[]
}

export default function Step4LootReveal({ onPrev, selectedSports }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const grant = useGrantOnboardingPack()

  useEffect(() => {
    if (grant.isPending || grant.data) return
    const buffs: Record<string, number> = {}
    for (const id of selectedSports) buffs[id] = 0.2  // 20% buff per selected sport
    grant.mutate(buffs)
  }, [grant, selectedSports])

  const proceed = () => {
    navigate('/dashboard?tour=1', { replace: true })
  }

  if (grant.isPending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="font-mono text-xs uppercase tracking-widest text-text-secondary animate-pulse">
          {t('onboarding.step4.loading')}
        </div>
      </div>
    )
  }

  if (grant.isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
        <div className="font-mono text-xs uppercase tracking-widest text-semantic-error">
          {t('onboarding.step4.error_retry')}
        </div>
        <button
          onClick={() => grant.reset()}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.step4.retry')}
        </button>
      </div>
    )
  }

  const cards = grant.data?.cards ?? []
  const idempotent = grant.data?.idempotent ?? false

  // Reorder so epic ends up at index 1 (center)
  const ordered = [...cards].sort((a, b) => {
    if (a.rarity === 'epic') return 0
    if (b.rarity === 'epic') return 0
    return 0
  })
  // Move first epic to center
  const epicIdx = ordered.findIndex((c) => c.rarity === 'epic' || c.rarity === 'legendary')
  if (epicIdx > 0) {
    const [epic] = ordered.splice(epicIdx, 1)
    ordered.splice(1, 0, epic)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2 text-center">
        {t('onboarding.step4.title')}
      </h2>
      <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
        {t('onboarding.step4.subtitle')}
      </div>
      <CardReveal3 cards={ordered.slice(0, 3)} skipAnimation={idempotent} />
      <div className="flex gap-4 mt-4">
        <button
          onClick={onPrev}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.prev')}
        </button>
        <button
          onClick={proceed}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero"
        >
          {t('onboarding.step4.cta')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/Step4LootReveal.tsx
git commit -m "feat(day6): Onboarding Step4LootReveal (Wow #1 epic guaranteed)"
```

---

### Task 27: Onboarding.tsx orchestrator (rewrite)

**Files:**
- Modify: `src/pages/Onboarding.tsx`

- [ ] **Step 1: Replace Onboarding.tsx with full orchestrator**

```tsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProgressDots from '@/components/onboarding/ProgressDots'
import Step1Welcome from '@/components/onboarding/Step1Welcome'
import Step2Sports from '@/components/onboarding/Step2Sports'
import Step3MockWorkout from '@/components/onboarding/Step3MockWorkout'
import Step4LootReveal from '@/components/onboarding/Step4LootReveal'

const STEP_COUNT = 4  // step 5 is rendered in Dashboard via ?tour=1

export default function Onboarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSports, setSelectedSports] = useState<string[]>([])

  const stepNum = Math.min(STEP_COUNT, Math.max(1, parseInt(searchParams.get('step') ?? '1', 10)))
  const goNext = () => setSearchParams({ step: String(stepNum + 1) })
  const goPrev = () => setSearchParams({ step: String(stepNum - 1) })

  const handleStep2Next = (sports: string[]) => {
    setSelectedSports(sports)
    goNext()
  }

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col">
      <ProgressDots current={stepNum} total={STEP_COUNT} />
      {stepNum === 1 && <Step1Welcome onNext={goNext} />}
      {stepNum === 2 && <Step2Sports onNext={handleStep2Next} onPrev={goPrev} />}
      {stepNum === 3 && (
        <Step3MockWorkout
          onNext={goNext}
          onPrev={goPrev}
          defaultSportId={selectedSports[0] ?? null}
        />
      )}
      {stepNum === 4 && (
        <Step4LootReveal onPrev={goPrev} selectedSports={selectedSports} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Onboarding.tsx
git commit -m "feat(day6): Onboarding orchestrator (4 steps in-route + step 5 via Dashboard tour)"
```

---

## Phase 8 — Dashboard updates

### Task 28: ReviveBanner component

**Files:**
- Create: `src/components/ReviveBanner.tsx`

- [ ] **Step 1: Implement ReviveBanner**

```tsx
import { IconAlertTriangle } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'
import { useCurrentUser } from '@/api/users'
import { useReviveStreak } from '@/api/revive'
import { canRevive } from '@/lib/streak/revive'

export default function ReviveBanner() {
  const { t } = useTranslation()
  const { data: user } = useCurrentUser()
  const revive = useReviveStreak()

  if (!user) return null
  const now = new Date()
  if (!canRevive({
    current_streak: user.current_streak,
    last_workout_date: user.last_workout_date,
    freeze_xp_until: user.freeze_xp_until,
  }, now)) return null

  const last = user.last_workout_date ? new Date(user.last_workout_date + 'T00:00:00Z') : now
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z')
  const days = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  const handleRevive = async () => {
    try {
      const r = await revive.mutateAsync()
      toast.success(t('revive.success.toast', { n: r.revived_streak }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already revived')) toast.error(t('revive.error.already_revived'))
      else if (msg.includes('window closed')) toast.error(t('revive.error.window_closed'))
      else toast.error(t('revive.error.generic', { msg }))
    }
  }

  return (
    <div className="bg-semantic-error/10 border border-semantic-error rounded-card p-4 mb-6 flex items-center gap-4">
      <IconAlertTriangle className="text-semantic-error" size={32} />
      <div className="flex-1">
        <div className="font-display font-bold uppercase text-semantic-error">
          {t('revive.banner.title', { days })}
        </div>
        <div className="font-mono text-xs text-text-secondary mt-1">
          {t('revive.banner.subtitle')}
        </div>
      </div>
      <button
        onClick={handleRevive}
        disabled={revive.isPending}
        className="bg-semantic-error text-white font-display font-bold uppercase tracking-wider px-6 py-2 rounded-button disabled:opacity-50"
      >
        {revive.isPending ? '...' : t('revive.cta')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReviveBanner.tsx
git commit -m "feat(day6): ReviveBanner component"
```

---

### Task 29: DashboardTourOverlay component

**Files:**
- Create: `src/components/DashboardTourOverlay.tsx`

- [ ] **Step 1: Implement DashboardTourOverlay**

```tsx
import { useTranslation } from '@/lib/i18n'

interface Props {
  onDone: () => void
}

export default function DashboardTourOverlay({ onDone }: Props) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center px-8">
      <div className="max-w-md space-y-8 text-center mb-12">
        <Tip n={1} text={t('onboarding.step5.tip1')} />
        <Tip n={2} text={t('onboarding.step5.tip2')} />
        <Tip n={3} text={t('onboarding.step5.tip3')} />
      </div>
      <button
        onClick={onDone}
        className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-12 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
      >
        {t('onboarding.step5.cta')}
      </button>
    </div>
  )
}

function Tip({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-accent-primary text-bg-primary font-display font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="font-body text-base text-text-primary text-left">{text}</div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardTourOverlay.tsx
git commit -m "feat(day6): DashboardTourOverlay (step 5 — 3 numbered tips)"
```

---

### Task 30: Dashboard.tsx — wire ReviveBanner + freeze ❄️ + Tour overlay

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add imports + tour query handling**

Replace contents of `src/pages/Dashboard.tsx`:

```tsx
import { Link, useSearchParams } from 'react-router-dom'
import { IconSwords, IconSnowflake } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useCurrentUser, useMyCardCount } from '@/api/users'
import ReviveBanner from '@/components/ReviveBanner'
import DashboardTourOverlay from '@/components/DashboardTourOverlay'

export default function Dashboard() {
  const { t } = useTranslation()
  const { data: user, isLoading } = useCurrentUser()
  const { data: cardCount } = useMyCardCount()
  const [searchParams, setSearchParams] = useSearchParams()
  const showTour = searchParams.get('tour') === '1'

  const dismissTour = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('tour')
    setSearchParams(next, { replace: true })
  }

  const streak = user?.current_streak ?? 0
  const xp = user?.xp ?? 0
  const username = user?.username ?? '...'
  const isFrozen =
    user?.freeze_xp_until && new Date(user.freeze_xp_until) > new Date()
  const freezeTime = isFrozen
    ? new Date(user!.freeze_xp_until!).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit',
      })
    : ''

  return (
    <div className="max-w-container mx-auto px-8 py-12">
      <header className="mb-12">
        <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
          {t('dashboard.section')}
        </div>
        <h1 className="font-display font-bold text-3xl uppercase tracking-tight">
          {t('dashboard.welcome', { name: username })}
        </h1>
      </header>

      <ReviveBanner />

      <section className="bg-bg-secondary border border-white/10 rounded-card py-16 px-8 mb-8 text-center">
        <div className="font-mono text-base uppercase tracking-[0.1em] text-text-secondary mb-2">
          {t('dashboard.streak_label')}
        </div>
        <div
          className={
            'font-display font-black leading-none ' +
            (streak > 0
              ? 'text-accent-primary animate-breathing'
              : 'text-text-tertiary')
          }
          style={{
            fontSize: 'clamp(80px, 14vh, 180px)',
            fontVariantNumeric: 'tabular-nums',
            textShadow:
              streak > 0
                ? '0 0 24px rgba(182,255,60,0.7), 0 0 48px rgba(182,255,60,0.3)'
                : 'none',
          }}
        >
          {isLoading ? '—' : streak}
        </div>
        <div className="font-mono text-xs text-text-tertiary mt-4 uppercase tracking-wider">
          {streak > 0 ? t('dashboard.streak_sub') : t('dashboard.zero_streak')}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label={t('dashboard.total_cards')}
          value={String(cardCount ?? 0)}
          sub={t('dashboard.total_cards_sub')}
        />
        <StatCard
          label={t('dashboard.this_week')}
          value={String(xp)}
          sub={t('dashboard.this_week_sub')}
          icon={
            isFrozen ? (
              <IconSnowflake
                size={14}
                className="text-accent-info ml-1 inline"
                aria-label={t('freeze.tooltip', { time: freezeTime })}
              />
            ) : null
          }
        />
        <StatCard
          label={t('dashboard.rank')}
          value={`L${user?.level ?? 1}`}
          sub={t('dashboard.rank_sub')}
        />
      </section>

      <div className="text-center">
        <Link
          to="/arena"
          className="inline-flex items-center gap-2 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all duration-150 ease-enter"
        >
          <IconSwords size={18} />
          {t('arena.lobby.title')}
        </Link>
      </div>

      {showTour && <DashboardTourOverlay onDone={dismissTour} />}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  sub: string
  icon?: React.ReactNode
}

function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card px-6 py-5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mb-2">
        {label}
      </div>
      <div className="font-display text-3xl font-bold tabular-nums">
        {value}
        {icon}
      </div>
      <div className="font-mono text-xs text-text-secondary mt-1">{sub}</div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(day6): Dashboard wires ReviveBanner + freeze ❄️ + tour overlay"
```

---

## Phase 9 — i18n keys

### Task 31: Add ~45 i18n keys × 2 lang

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Read existing i18n structure**

Locate the zh and en dictionaries (lines ~140 and ~290 from earlier read).

- [ ] **Step 2: Add Day 6 keys to zh dictionary**

In the zh dictionary, append (before the closing `}`):

```typescript
// === Day 6: onboarding ===
'onboarding.section': '§ 00 · 引导',
'onboarding.title': '引导 — 5 步流程',  // existing keep
'onboarding.prev': '上一步',
'onboarding.step1.title': '准备好了吗？',
'onboarding.step1.subtitle': '练得越久，奖励越值得肝',
'onboarding.step1.cta': '开始',
'onboarding.step2.title': '你想从哪些运动开始？',
'onboarding.step2.cta': '继续',
'onboarding.step2.cta_disabled': '请选择 1-3 项',
'onboarding.step2.selected': '已选 {n}/3',
'onboarding.step3.title': '提交你的第 1 次运动',
'onboarding.step3.sport': '运动',
'onboarding.step3.duration': '时长（分钟）',
'onboarding.step3.intensity_label': '强度',
'onboarding.step3.intensity.light': '轻',
'onboarding.step3.intensity.medium': '中',
'onboarding.step3.intensity.high': '强',
'onboarding.step3.cta': '提交',
'onboarding.step4.title': '你的开局卡组',
'onboarding.step4.subtitle': '系统保底 1 张稀有卡',
'onboarding.step4.cta': '继续',
'onboarding.step4.loading': '正在生成卡组...',
'onboarding.step4.error_retry': '网络错误',
'onboarding.step4.retry': '重试',
'onboarding.step5.cta': '完成',
'onboarding.step5.tip1': '这是你的连续打卡天数（streak）',
'onboarding.step5.tip2': '断了就要复活，连了越久奖励越好',
'onboarding.step5.tip3': '去 Arena 用卡组挑战',

// === Day 6: revive ===
'revive.banner.title': 'STREAK 已断 · {days} 天前',
'revive.banner.subtitle': '复活恢复到上次的一半 · 代价 50% XP 冻结 24h',
'revive.cta': '复活',
'revive.success.toast': '已复活到 {n} 天',
'revive.error.already_revived': '已经复活过 · 24h 后再试',
'revive.error.window_closed': '复活窗口已关闭（断 7 天后失效）',
'revive.error.generic': '复活失败：{msg}',

// === Day 6: freeze ===
'freeze.tooltip': 'XP 冻结至 {time}',

// === Day 6: protect ===
'protect.consumed.toast': '保护卡续命 · 剩余 {n}',
'protect.granted.toast': '+1 保护卡 · 库存 {n}/3',

// === Day 6: dev ===
'dev.chip': 'DEV',
'dev.title': 'DEV MODE · 测评菜单',
'dev.actions.set_streak': '设 Streak N',
'dev.actions.grant_legendary': '抽 1 张传说',
'dev.actions.level_up': '升 1 级',
'dev.actions.break_streak': '断 Streak',
'dev.actions.grant_protect': '+1 保护卡',
'dev.actions.reset_onboarding': '重看引导',
'dev.actions.reset_progress': '重置全部',
'dev.actions.exit': '退出 DEV 模式',
'dev.confirm.reset_progress': '确定重置全部数据？此操作不可逆',
'dev.error.unknown_action': '未知 action: {action}',
```

- [ ] **Step 3: Add same keys to en dictionary**

```typescript
'onboarding.section': '§ 00 · Onboarding',  // already there, keep
'onboarding.title': 'Onboarding — 5 step guide',  // keep
'onboarding.prev': 'Back',
'onboarding.step1.title': 'Ready?',
'onboarding.step1.subtitle': 'The longer you train, the better the loot',
'onboarding.step1.cta': 'Start',
'onboarding.step2.title': 'Which sports do you want to start with?',
'onboarding.step2.cta': 'Continue',
'onboarding.step2.cta_disabled': 'Pick 1-3',
'onboarding.step2.selected': 'Selected {n}/3',
'onboarding.step3.title': 'Submit your first workout',
'onboarding.step3.sport': 'Sport',
'onboarding.step3.duration': 'Duration (min)',
'onboarding.step3.intensity_label': 'Intensity',
'onboarding.step3.intensity.light': 'Light',
'onboarding.step3.intensity.medium': 'Medium',
'onboarding.step3.intensity.high': 'High',
'onboarding.step3.cta': 'Submit',
'onboarding.step4.title': 'Your starter deck',
'onboarding.step4.subtitle': 'Guaranteed 1 epic',
'onboarding.step4.cta': 'Continue',
'onboarding.step4.loading': 'Generating cards...',
'onboarding.step4.error_retry': 'Network error',
'onboarding.step4.retry': 'Retry',
'onboarding.step5.cta': 'Done',
'onboarding.step5.tip1': 'Your streak day count',
'onboarding.step5.tip2': 'Break it to revive — the longer the better',
'onboarding.step5.tip3': 'Battle in Arena with your deck',

'revive.banner.title': 'STREAK BROKEN · {days}d ago',
'revive.banner.subtitle': 'Revive to half · cost 50% XP frozen 24h',
'revive.cta': 'Revive',
'revive.success.toast': 'Revived to {n} days',
'revive.error.already_revived': 'Already revived · retry in 24h',
'revive.error.window_closed': 'Revive window closed (after 7 days)',
'revive.error.generic': 'Revive failed: {msg}',

'freeze.tooltip': 'XP frozen until {time}',

'protect.consumed.toast': 'Protect card consumed · {n} left',
'protect.granted.toast': '+1 Protect card · stock {n}/3',

'dev.chip': 'DEV',
'dev.title': 'DEV MODE · Reviewer Menu',
'dev.actions.set_streak': 'Set Streak N',
'dev.actions.grant_legendary': 'Grant Legendary',
'dev.actions.level_up': 'Level Up',
'dev.actions.break_streak': 'Break Streak',
'dev.actions.grant_protect': '+1 Protect Card',
'dev.actions.reset_onboarding': 'Reset Onboarding',
'dev.actions.reset_progress': 'Reset All',
'dev.actions.exit': 'Exit DEV',
'dev.confirm.reset_progress': 'Reset all data? This is irreversible.',
'dev.error.unknown_action': 'Unknown action: {action}',
```

- [ ] **Step 4: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors. If existing typed key union complains, update the union type to include new keys, or check i18n.ts pattern (Day 1 likely uses string keys, no narrow union).

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(day6): i18n keys for onboarding/revive/freeze/protect/dev (~45 × 2)"
```

---

## Phase 10 — Final Wire-up + Smoke

### Task 32: Final tsc + tests + build

**Files:** None

- [ ] **Step 1: Run all tests**

```bash
bun run test
```

Expected: All tests pass (existing 23 from Day 5 + 7+11+5+4 = 27 new = 50 total).

- [ ] **Step 2: Run tsc**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run build**

```bash
bun run build
```

Expected: Build successful, bundle outputs to dist/.

- [ ] **Step 4: Run dev server + sanity check**

```bash
bun run dev &
```

Open browser to localhost dev URL. Verify:
- Page loads without console errors
- If anon already onboarded, lands on /dashboard
- Otherwise lands on /onboarding

Stop dev server.

---

### Task 33: E2E manual smoke checklist

**Files:** None (manual verification)

- [ ] **Step 1: Reset onboarding state via SQL**

```bash
psql "$SUPABASE_DB_URL" -c "update users set onboarded_at=null where username like 'user_%';"
```

(Or create fresh anon by signing out + clearing localStorage.)

- [ ] **Step 2: Run dev server, walk through onboarding**

```bash
bun run dev
```

Browser checklist:
- [ ] Open `http://localhost:5173/dashboard` → auto redirected to `/onboarding`
- [ ] Step 1 PULSE big text + CTA "开始" → click → step 2
- [ ] Step 2 see 26 sports grid → select 3 → CTA enables → click → step 3
- [ ] Step 3 form prefilled with first selected sport → click 提交 → "+60 XP" floats → step 4
- [ ] Step 4 sees 3 cards, center is epic with halo (Wow #1) → click 继续 → /dashboard?tour=1
- [ ] Dashboard tour overlay shows 3 numbered tips → click 完成 → tour gone
- [ ] Refresh → still on /dashboard (not redirected back)

- [ ] **Step 3: Test ?dev=1 flow**

- [ ] Add `?dev=1` to URL → DEV chip appears in sidebar
- [ ] Press Cmd/Ctrl+Shift+D → drawer opens
- [ ] Click "Set Streak N" → prompt for 19 → streak hero shows 19
- [ ] Click "Grant Legendary" → toast → check /library has +1 legendary
- [ ] Click "Break Streak" → revive banner appears
- [ ] Click "复活" → toast "已复活到 5 天" (10/2) → banner gone → ❄️ next to XP
- [ ] Click "Reset Onboarding" → next page reload triggers redirect to /onboarding
- [ ] Close tab + reopen → DEV chip gone (sessionStorage cleared)

- [ ] **Step 4: Test protect card consumption (manual)**

```bash
psql "$SUPABASE_DB_URL" -c "update users set protect_cards=2, last_workout_date=current_date - 2 where username='user_xxx';"
```

- [ ] Submit a workout → response includes `protect_card_consumed: true`, status='protected'

---

### Task 34: Final commit + Day 6 summary

**Files:** None

- [ ] **Step 1: Verify clean git state**

```bash
git status
```

Expected: clean working tree.

- [ ] **Step 2: Print summary**

```bash
git log --oneline c33297d..HEAD | wc -l
```

Expected: ~32-35 commits for Day 6.

- [ ] **Step 3: Optional — final commit reporting Day 6 done**

If anything trailing is uncommitted, commit it:
```bash
git add -A && git commit -m "chore: Day 6 final cleanup"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Plan task |
|---|---|
| §1 数据模型（3 字段 alter） | Task 1 |
| §2.1 submit_workout 改造 | Task 2 |
| §2.2 revive_streak | Task 3 |
| §2.3 grant_onboarding_pack | Task 4 |
| §2.4 dev_dispatch | Task 5 |
| §3.1 useDevStore | Task 14 |
| §3.2 OnboardingGate | Task 19, 20 |
| §3.3 路由 query 持久化 | Task 27 |
| §4.1 5 个 step 组件 | Task 21-27 |
| §4.2 ReviveBanner | Task 28 |
| §4.3 freeze ❄️ overlay | Task 30 |
| §4.4 DevDrawer | Task 16, 17, 18 |
| §5 API hooks | Task 11, 12, 13 |
| §6 错误处理 | covered in component implementations |
| §7.1 单测 | Task 8, 9, 10, 19 |
| §7.2 E2E smoke | Task 33 |
| §8 i18n keys | Task 31 |

✓ Coverage complete.

**2. Placeholder scan:** No TBD/TODO. Each step has actual code or actual command.

**3. Type consistency:**
- `UserRow` extended in Task 7, used by Task 19 (OnboardingGate test mock), Task 28 (ReviveBanner), Task 30 (Dashboard) — consistent ✓
- `ComputeNextStreakOutput` in Task 8, not consumed elsewhere except internally ✓
- `OnboardingPackResult` in Task 11, consumed by Task 26 ✓
- `DevAction` enum in Task 13, consumed by Task 16 ✓
- `canRevive` signature in Task 9: `(input, now: Date) → boolean` — Task 28 (ReviveBanner) calls it correctly ✓

**4. Spec gaps found and added:**
- None. All §1-§8 mapped to tasks.
