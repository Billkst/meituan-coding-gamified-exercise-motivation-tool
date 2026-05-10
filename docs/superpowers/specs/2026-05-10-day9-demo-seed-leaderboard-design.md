# Day 9 — Demo Seed + Leaderboard Design

**Date:** 2026-05-10
**Status:** APPROVED (scope: Demo seed + Leaderboard 组合)

## Goal

Day 1-8 把单玩家闭环全做了，但 db 里只有评审自己的匿名 user，**没人可比**。Day 9 加：

- 8 个 fake demo users（不同 progression 状态：新手 / 中等 / 高玩 / 大神），带丰富 workouts / user_cards / streaks 数据
- 全服 Leaderboard 页面：period tabs（总榜 / 本月 / 本周）+ 自己置顶高亮 + "超越 X%"
- 评审打开站点能看到："我现在是第 N 名 / 已经超越了 65% 的玩家"

## Premises

- Demo users 直接 insert 到 `auth.users` + `public.users`（postgres role 在 migration 里有权限）
- demo 不登录、不创 identities（保持简单）
- Leaderboard v1 = 单一 score 维度（按 period），不做多榜（card 收集榜 / arena 胜率榜 — 后续 Day）
- Leaderboard limit 100（够展示 + 不太大）
- 不做分页 / 翻页
- 不做"超越具体某用户" 通知

## Architecture

层次：
1. **Server:** 2 个新 migration
   - migration 16: demo seed（auth.users + public.users + workouts + user_cards + streaks 的 8 个 demo + 关联数据）
   - migration 17: `get_leaderboard(p_period, p_limit)` RPC
2. **Client:** 1 个 hook + 1 个 page + 1 个 sidebar 入口
3. **i18n:** ~12 keys × 2 lang

---

## 1. Demo Seed（migration 16）

### 1.1 8 个 demo 用户档案

| id 后缀 | username | level | xp | total_workouts | current_streak | longest_streak | season_score | 风格 |
|---|---|---|---|---|---|---|---|---|
| `01` | speedster_777 | 14 | 5800 | 92 | 18 | 25 | 1450 | 高玩 |
| `02` | iron_will_42 | 11 | 3900 | 68 | 12 | 18 | 980 | 中高 |
| `03` | flexible_jane | 9 | 2700 | 45 | 7 | 14 | 720 | 中 |
| `04` | hiit_demon | 13 | 4500 | 78 | 21 | 21 | 1180 | 中高 |
| `05` | yoga_panda | 6 | 1400 | 28 | 5 | 10 | 410 | 中等 |
| `06` | basket_king | 8 | 2200 | 36 | 0 | 11 | 580 | 断 streak |
| `07` | climber_mary | 4 | 850 | 18 | 3 | 8 | 240 | 新手 |
| `08` | cardio_lord | 16 | 7200 | 120 | 30 | 45 | 1800 | 大神 |

UUID 用 deterministic 模式 `'11111111-1111-4111-8111-1111111111XX'`（XX = 01-08），方便查 / 调试。

### 1.2 衍生数据

每个 demo user 至少：
- 5-15 个最近 30 天的 workouts（不同 sport，xp_gained 跟 level 匹配）
- 5-30 张 user_cards（rarity 分布按 level 加权）
- 1-2 个 streaks 行（active + 可能的 broken）

注意：
- workouts 用 `created_at = now() - random_interval` 散布在过去 30 天，让 leaderboard 周/月数据合理
- user_cards 仅 insert `(user_id, card_id, copies=1)`，不改 decks（demo 不会出战）
- streaks: 1 个 active 行 + 高玩可能再加 1 个 broken

### 1.3 SQL 模板

```sql
-- ===== auth.users (minimal seed) =====
insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'demo01@pulse.test', 'authenticated', 'authenticated', '', now() - interval '60 days', now() - interval '60 days', now(), '{}'::jsonb, '{}'::jsonb),
  ...
on conflict (id) do nothing;

-- ===== public.users =====
insert into public.users (id, username, level, xp, total_workouts, current_streak, longest_streak, last_workout_date, season_score, exploration_buffs, protect_cards, created_at, updated_at, last_protect_grant_at, onboarded_at)
values ...
on conflict (id) do nothing;

-- ===== workouts =====
-- 用 generate_series 散布在 30 天，每个 demo 5-15 行
insert into public.workouts (user_id, sport_id, duration_minutes, intensity, xp_gained, cards_drawn, created_at)
select
  '11111111-1111-4111-8111-111111111101'::uuid,
  'running',
  20 + (random() * 30)::int,
  case when random() < 0.4 then 'medium' when random() < 0.7 then 'high' else 'light' end,
  60 + (random() * 80)::int,
  array['c_endurance'],
  now() - (interval '1 hour' * (random() * 24 * 30)::int)
from generate_series(1, 12);
-- 重复 8 次（每个 demo）

-- ===== user_cards =====
-- 各 demo 按 level 加权随机抽 N 张
insert into public.user_cards (user_id, card_id, copies)
select
  '11111111-1111-4111-8111-111111111108'::uuid,  -- cardio_lord (level 16, ~30 cards)
  c.id,
  1
from public.cards c
order by random()
limit 30
on conflict (user_id, card_id) do nothing;

-- ===== streaks =====
insert into public.streaks (user_id, start_date, length, status)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, current_date - 17, 18, 'active'),
  ...
on conflict do nothing;
```

---

## 2. Leaderboard RPC（migration 17）

### 2.1 签名

```sql
create or replace function public.get_leaderboard(
  p_period text default 'all',  -- 'all' | 'month' | 'week'
  p_limit int default 100
) returns jsonb
```

### 2.2 返回结构

```json
{
  "period": "all",
  "total_users": 9,
  "user_rank": 5,
  "user_score": 160,
  "user_percentile": 44,
  "entries": [
    {
      "rank": 1,
      "user_id": "...",
      "username": "cardio_lord",
      "level": 16,
      "score": 1800,
      "streak": 30,
      "is_self": false
    },
    ...
  ]
}
```

### 2.3 实现要点

```sql
declare
  v_user_id uuid := auth.uid();
  v_period_start timestamptz;
begin
  if p_period = 'week' then v_period_start := now() - interval '7 days';
  elsif p_period = 'month' then v_period_start := now() - interval '30 days';
  end if;

  return (
    with scores as (
      select
        u.id, u.username, u.level, u.current_streak,
        case when v_period_start is null
          then u.season_score::int
          else coalesce((select sum(xp_gained)::int from workouts where user_id = u.id and created_at >= v_period_start), 0)
        end as score
      from users u
    ),
    ranked as (
      select id, username, level, current_streak, score,
        dense_rank() over (order by score desc) as rnk
      from scores
    )
    select jsonb_build_object(
      'period', p_period,
      'total_users', (select count(*) from users),
      'user_rank', (select rnk from ranked where id = v_user_id),
      'user_score', (select score from ranked where id = v_user_id),
      'user_percentile', case when (select count(*) from users) > 1
        then 100 - round((select rnk from ranked where id = v_user_id)::numeric / (select count(*) from users) * 100)::int
        else 0 end,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', rnk,
          'user_id', id,
          'username', username,
          'level', level,
          'score', score,
          'streak', current_streak,
          'is_self', id = v_user_id
        ) order by rnk, id)
        from ranked
        where rnk <= p_limit
      ), '[]'::jsonb)
    )
  );
end;
```

注意：
- `dense_rank` 而非 `rank`：分数相同的用户共享 rank，下一个 rank 不跳号（更友好）
- `user_percentile = 100 - rank/total*100` 给"超越 X%"
- entries 用 `dense_rank <= limit`（保证如果有 ties 在 limit boundary 不被截断）

### 2.4 grant

```sql
grant execute on function public.get_leaderboard(text, int) to anon, authenticated;
```

---

## 3. 客户端

### 3.1 hook `src/api/leaderboard.ts`

```ts
export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  level: number
  score: number
  streak: number
  is_self: boolean
}

export interface LeaderboardResponse {
  period: 'all' | 'month' | 'week'
  total_users: number
  user_rank: number | null
  user_score: number | null
  user_percentile: number
  entries: LeaderboardEntry[]
}

export function useLeaderboard(period: 'all' | 'month' | 'week') { ... }
```

### 3.2 page `/leaderboard`

布局：
```
§ 10 · 排行榜
LEADERBOARD

[ 总榜 ] [ 本月 ] [ 本周 ]      9 名玩家

┌──────────────────────────────────────────────────┐
│ 你 · 第 5 名 · 超越了 44% 的玩家      160 XP    │
└──────────────────────────────────────────────────┘

  #1  🏆 cardio_lord    L16   🔥30      1800
  #2     speedster_777  L14   🔥18      1450
  #3     hiit_demon     L13   🔥21      1180
  #4     iron_will_42   L11   🔥12      980
► #5     user_4c83b449  L1    🔥1       160       ← self highlight
  #6     basket_king    L8    🔥0       580 (按 score 应该是 #4 但 period=all 用 season_score)
  ...
```

要点：
- Period tabs: 3 个 button，active 高亮
- 自己置顶卡（位置无关），含 "你 · 第 X 名 · 超越了 Y% 的玩家"
- 列表 100 条
- self 行用 `border-l-2 border-accent-primary` + bg-accent-primary/10 高亮
- 前 3 名 rank 加 medal 图标（🏆 金 / 🥈 银 / 🥉 铜）
- streak 用 IconFlame
- score 显示成 tabular-nums + 右对齐

### 3.3 Sidebar entry

`{ to: '/leaderboard', key: 'nav.leaderboard', icon: 'ti-trophy-filled' }` — 但已有 trophy（成就），用 `ti-medal` 区分。

放在 "数据" 之后。

---

## 4. i18n（约 14 keys）

```
nav.leaderboard
leaderboard.section, leaderboard.title
leaderboard.tabs.all, .month, .week
leaderboard.summary.total_users
leaderboard.self.title, .your_rank, .percentile
leaderboard.row.level_label
leaderboard.empty
leaderboard.loading
```

---

## 5. 边缘情况

| 场景 | 处理 |
|---|---|
| 当前用户没排名（不在 entries / 没数据） | self 卡显示 "—"，不显示 percentile |
| period 内某用户全没 workout | score = 0，rank 倒数（多人共享底部） |
| 第 1 名 / 唯一用户 | rank 1, percentile 0（"超越 0%"），UI 显示 "你是第一名！" |
| total_users = 1 | 不显示 percentile 句子，仅"你是第一名" |
| 多人 score 相同 | dense_rank 共享，列表按 rank, id 二级排序 |
| limit boundary 上有 tie | RPC 保证不截断（只比 dense_rank） |

---

## 6. 验收标准

- [ ] migration 16 push 成功，db 增加 8 个 demo users + ~80 workouts + ~150 user_cards + 8-10 streaks
- [ ] migration 17 push 成功，get_leaderboard RPC 部署
- [ ] Sidebar 加 "排行榜" 入口
- [ ] `/leaderboard` page 渲染 period tabs + self 卡 + 100 条列表
- [ ] 切换 tabs 排名正确变（总榜 ≠ 本周 ≠ 本月）
- [ ] self 行高亮 + "超越 X%" 显示
- [ ] 前 3 名 medal 图标
- [ ] tsc clean / build 成功 / 全部 tests pass

---

## 7. 工作量分解

| 阶段 | 估时 |
|---|---|
| migration 16 demo seed | 3h |
| migration 17 RPC | 1h |
| types + hook | 0.5h |
| Leaderboard page + Sidebar + i18n + 行组件 | 4h |
| smoke + bug fix | 1h |
| **总计** | **~9.5h ≈ 1.5 day** |
