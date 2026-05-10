# Day 8 Plan — Stats 数据可视化

**Spec:** `docs/superpowers/specs/2026-05-10-day8-stats-visualization-design.md`
**Date:** 2026-05-10
**Estimated:** ~8.5h / 1 工作日 / 8 离散 task

---

## File Structure

新增：
```
supabase/migrations/20260510000015_day8_user_stats_rpc.sql

src/api/stats.ts                          # 1 hook
src/pages/Stats.tsx                       # page

src/components/stats/StatsSummary.tsx
src/components/stats/XpTrendChart.tsx     # pure SVG line + avg
src/components/stats/SportBreakdownChart.tsx  # div + tailwind
src/components/stats/ArenaPieChart.tsx    # SVG donut
src/components/stats/CardCollectionChart.tsx  # div + tailwind
```

修改：
```
src/types/db.ts                           # add UserStats interface
src/components/Sidebar.tsx                # add nav.stats
src/App.tsx                               # /stats route
src/lib/i18n.ts                           # ~18 keys × 2 lang
```

---

## Tasks

### Task 1 — migration 15: get_user_stats RPC

完整内容见 spec §1。SQL 要点：
- `auth.uid()` 强制 + raise on null
- summary：从 users + workouts + battles + user_cards 聚合
- `xp_trend`：`generate_series(today-29, today, '1 day')` left join workouts daily sum
- `sport_breakdown`：`select sport_id, count(*), sum(duration_minutes) ... order by count desc limit 10`
- `arena`：count from battles attacker_id=uid + winner_id=uid
- `card_collection`：4 rarity 行；`total` 来自 cards 表，`owned` 来自 user_cards distinct

push migration（按 CLAUDE.md gotcha 节）。

**Verify:** REST API call returns all 5 keys with correct types。

**Commit:** `feat(day8): migration 15 — get_user_stats RPC (5-section aggregation)`

### Task 2 — types/db.ts + api/stats.ts

`UserStats` interface（spec §2.1 完整定义）+ `useUserStats` hook（useQuery, queryKey 含 user.id, enabled）。

**Verify:** `bunx tsc --noEmit` 干净。

**Commit:** `feat(day8): UserStats type + useUserStats hook`

### Task 3 — Stats page skeleton + Sidebar + i18n

- `pages/Stats.tsx`：用 `useUserStats`，loading state，渲染 5 区占位
- `components/Sidebar.tsx`：加 `{ to: '/stats', key: 'nav.stats', icon: 'ti-chart-bar' }`
- `App.tsx`：加 `/stats` route
- `lib/i18n.ts`：18 keys × 2 lang

**Verify:** 浏览器打开 `/stats` 显示 loading → page 骨架（5 区文字 placeholder）。

**Commit:** `feat(day8): Stats page skeleton + Sidebar entry + i18n (18 keys × 2 lang)`

### Task 4 — StatsSummary

6 tile grid + page header subline。复用 Dashboard 的 StatCard 风格。

`total_minutes` 格式化函数 `formatMinutes(n)` → "22h 30m"（>= 60 时分两段）。

**Commit:** `feat(day8): StatsSummary component`

### Task 5 — XpTrendChart (SVG)

固定 height=200，viewBox 0 0 800 200。

实现要点：
- `maxY = Math.max(...data.map(d => d.xp), 100)`
- 30 个点：`x = (i / 29) * 740 + 30`（30 padding 左 30 padding 右）
- `y = 180 - (d.xp / maxY) * 160`（top padding 20，bottom padding 20）
- polyline 连接所有点
- avg 横线 dashed
- 当日点 r=4，其他 r=2.5
- 底部 X-axis "30 天前 ... 今天"

empty state（all xp = 0）：替换为 "你最近 30 天没训练" + button → `/workout`。

**Commit:** `feat(day8): XpTrendChart (pure SVG, 30-day line + avg)`

### Task 6 — SportBreakdownChart

div + tailwind。`top1` 高亮（accent-primary），其他渐弱。

每行：sport icon (从 sports 表数据)? 实际上 sport_breakdown 只返回 sport_id，前端要匹配 sports 表拿 name + icon。**用 useSports hook（如果存在）拿 sport meta。**

如果没有 useSports：直接用 sport_id 显示也可以（v1 简化）。Day 1 应该有 sports list，让我假设有 useSports 直接 join。

empty state："还没运动记录"。

**Commit:** `feat(day8): SportBreakdownChart (top 10 horizontal bar)`

### Task 7 — ArenaPieChart (SVG donut)

半圆 donut（180° arc），使用 SVG `<path>` 的 `A` arc command。

中心大字 "X%"；底部 W/L 数字 + 出战次数。

实现要点：
- viewBox 0 0 200 120
- 整体半圆作为背景灰色
- wins 部分覆盖（弧角度按 win_rate_pp 计算）
- empty: 全灰半圆 + "还没出战"

**Commit:** `feat(day8): ArenaPieChart (SVG semicircle donut)`

### Task 8 — CardCollectionChart + Stats wire-up + smoke

- 4 行 div + tailwind 进度条
- rarity 颜色映射：common gray / rare blue / epic purple / legendary gold（已有 tailwind tokens）
- 把 5 个 chart 组件 wire 进 Stats.tsx
- 跑 e2e smoke：访问 /stats，看是否所有区都正确渲染

可能 smoke 抓出 bug，fix 在同 commit 或紧跟一个 fix commit。

**Verify:** tsc clean / 57+/57+ tests / build 成功 / page 5 区都渲染

**Commit:** `feat(day8): CardCollectionChart + wire Stats page (5 sections)`

---

## Risk Register

| 风险 | 缓解 |
|---|---|
| migration 15 push 卡 IPv4 | CLAUDE.md gotcha 节有 workaround |
| sport_breakdown 没法 join sports name | fallback 显示 sport_id（v1 mini scope）；正式 fix 加 useSports hook 拿 meta |
| SVG line 在 30 天全 0 时显示退化 | empty state 检测 + 替换为 hint |
| Arena 半圆角度计算 | 用 SVG path A 命令，test 0/50/100% 三个 case |
| RPC 响应 size 过大 | spec 估算 < 5KB，远低于 supabase 阈值 |

---

## Known Issues（开发期间填）

(none)
