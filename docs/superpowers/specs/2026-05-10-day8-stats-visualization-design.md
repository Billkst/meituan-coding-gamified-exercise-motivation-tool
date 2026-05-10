# Day 8 — Stats 数据可视化 Design

**Date:** 2026-05-10
**Status:** APPROVED (scope: 全部按提案)
**Source route:** Day 7 收官后的 retention 闭环另一面（成就 = 看里程碑，stats = 看趋势）

## Goal

让玩家"看到自己进步"。Day 1-7 把短期 hook + 长期目标都做了，但玩家**自我认知**还缺一块：

- 这周训练比上周多吗？
- 我最爱什么运动？时间花得最多的是什么？
- Arena 胜率多少？
- 我的卡组有多齐？

新 `/stats` page 用 5 区可视化集中回答这些问题。评审打开 stats 也能直接看到产品深度。

## Premises

- 不引入 chart lib（recharts 80KB 等）。SVG + tailwind 自己画 4 个简单图够用，避免 4MB JS bundle 再涨。
- 不写 trend line 算法 / 不做"AI 洞察"文本（Day 7 加重选项被拒）。仅展示数据。
- 不做导出 CSV / 不做时间区间筛选（v1 固定 30 天 XP + 全期 sport / arena / card）。
- 数据全后端聚合（1 个 RPC 一次拿完），客户端零计算。

## Architecture

**RPC First**：`get_user_stats()` 一次返回所有 5 区数据。前端只渲染。

层次：
1. **Server (Supabase RPC):** 1 个新 RPC，没有新表，没有 schema 改动
2. **Client API:** 1 个 hook（`@/api/stats.ts` → `useUserStats()`）
3. **UI:**
   - 新 page `/stats`
   - 5 个区组件（StatsSummary、XpTrendChart、SportBreakdownChart、ArenaPieChart、CardCollectionChart）
4. **i18n:** ~15 keys × 2 lang

---

## 1. RPC: `get_user_stats()`

**Returns:** 单个 jsonb，结构：

```json
{
  "summary": {
    "joined_days": 12,
    "total_workouts": 45,
    "total_minutes": 1320,
    "total_xp": 3850,
    "level": 4,
    "card_count": 18,
    "card_total_pool": 120,
    "arena_wins": 7,
    "arena_losses": 3,
    "current_streak": 5,
    "longest_streak": 12
  },
  "xp_trend": [
    { "date": "2026-04-11", "xp": 0 },
    { "date": "2026-04-12", "xp": 60 },
    { "date": "2026-04-13", "xp": 120 },
    ... (exactly 30 entries, oldest → newest, 0-fills missing days)
  ],
  "sport_breakdown": [
    { "sport_id": "running", "count": 8, "total_minutes": 240 },
    { "sport_id": "hiit", "count": 5, "total_minutes": 100 },
    ... (top 10 by count desc, ties broken by sport_id asc)
  ],
  "arena": {
    "wins": 7,
    "losses": 3,
    "battles_total": 10,
    "win_rate_pp": 70
  },
  "card_collection": [
    { "rarity": "common",    "owned": 30, "total": 50 },
    { "rarity": "rare",      "owned": 12, "total": 30 },
    { "rarity": "epic",      "owned": 5,  "total": 20 },
    { "rarity": "legendary", "owned": 2,  "total": 20 }
  ]
}
```

**实现要点：**

```sql
create or replace function public.get_user_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user users%rowtype;
  v_today date := current_date;
  ...
begin
  -- summary metrics from users + aggregates
  -- xp_trend: generate_series(today-29, today) left join workouts.daily_xp
  -- sport_breakdown: top 10 by count
  -- arena: count from battles where attacker_id=uid; winner = uid → win
  -- card_collection: select rarity, count(distinct cards.id) total, count(distinct user_cards.card_id) owned
  return jsonb_build_object(...);
end;
$$;
grant execute on function public.get_user_stats() to anon, authenticated;
```

特殊点：
- `xp_trend` 必须返回正好 30 行（含 0 XP 的空白日），用 `generate_series(today - 29, today, '1 day')` 左连 workouts daily sum
- `joined_days` = `current_date - created_at::date + 1`
- `arena_wins` 来自 `battles where attacker_id = uid AND winner_id = uid`
- `card_total_pool` = `(select count(*) from cards)`（≈120）
- `arena.win_rate_pp` = round(wins / battles_total * 100); battles_total = 0 时返回 0

---

## 2. 客户端

### 2.1 hook `src/api/stats.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

export interface UserStats {
  summary: { joined_days: number; total_workouts: number; total_minutes: number; total_xp: number; level: number; card_count: number; card_total_pool: number; arena_wins: number; arena_losses: number; current_streak: number; longest_streak: number }
  xp_trend: Array<{ date: string; xp: number }>
  sport_breakdown: Array<{ sport_id: string; count: number; total_minutes: number }>
  arena: { wins: number; losses: number; battles_total: number; win_rate_pp: number }
  card_collection: Array<{ rarity: 'common' | 'rare' | 'epic' | 'legendary'; owned: number; total: number }>
}

export function useUserStats() {
  const authUser = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['user_stats', authUser?.id],
    queryFn: async (): Promise<UserStats> => {
      const { data, error } = await supabase.rpc('get_user_stats' as never)
      if (error) throw error
      return data as unknown as UserStats
    },
    enabled: !!authUser,
  })
}
```

---

## 3. UI 设计

### 3.1 page 布局

```
[ Sidebar: 主页 / 运动 / 打卡 / 抽卡 / 对战 / 卡库 / 卡组 / 成就 / Stats ]

§ 09 · STATS

数据      ──────────────────

┌──────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ summary  │ workouts│ minutes │ xp      │ cards   │ arena   │
└──────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

┌─ 30 天 XP 趋势 ─────────────────────────────────┐
│                              ╱╲                 │
│   ╱╲                ╱╲      ╱  ╲    avg ──────  │
│  ╱  ╲    ╱╲   ╱╲   ╱  ╲   ╱     ╲              │
│ ╱    ╲  ╱  ╲_╱  ╲_╱    ╲_╱       ╲             │
│ ───────────────────────────── 30天             │
└──────────────────────────────────────────────────┘

┌─ 运动多样性 top 10 ─────────┐  ┌─ Arena 战绩 ──────┐
│ 跑步    ████████ 8 / 240分  │  │      胜 7         │
│ HIIT    █████ 5 / 100分     │  │   ●70%●           │
│ 瑜伽    ████ 4 / 80分        │  │      负 3         │
│ ...                          │  │ 出战 10           │
└──────────────────────────────┘  └───────────────────┘

┌─ 卡牌收集 ─────────────────────────────────────┐
│ common    ▓▓▓▓▓▓░░░░ 30 / 50                  │
│ rare      ▓▓▓▓░░░░░░ 12 / 30                  │
│ epic      ▓▓░░░░░░░░  5 / 20                  │
│ legendary ▓░░░░░░░░░  2 / 20                  │
└────────────────────────────────────────────────┘
```

### 3.2 Summary 行

6 个 stat tiles 横排（grid-cols-3 在窄屏，grid-cols-6 在宽屏）。

每 tile 复用现有 Dashboard 的 `StatCard` 风格（mono uppercase label + display tabular value + sub line）。

字段 → label 映射：
- `total_workouts` → "训练次数"
- `total_minutes` → "总分钟"（格式化为 "22h" 或 "22h 30m"）
- `total_xp` → "总 XP"
- `level` → "段位"
- `card_count` → "卡牌"（"X / Y"）
- `arena_wins / arena_losses` → "Arena"（"7W / 3L"）

`joined_days` 放 page header sub line：「加入 12 天 · 当前连击 5 天 · 历史最长 12 天」。

### 3.3 XpTrendChart（line + avg）

纯 SVG，固定高度 200，宽度跟随容器（responsive via viewBox）。

输入：`data: Array<{date, xp}>`（30 entries）。

绘制：
- Y 轴：从 0 到 max(xp_max, 100) （min cap 100 防止全 0 时图全平）
- X 轴：30 天
- 折线：连接 30 个点
- avg 横线：dashed，跨整个宽度，标 "avg X XP"
- 当日点：highlighted dot，大小是普通点的 1.5x

颜色：
- 折线：`stroke-accent-primary`
- 圆点：`fill-accent-primary`
- avg dashed：`stroke-text-tertiary`
- grid：`stroke-white/5`

无数据时显示 "你最近 30 天没训练。打卡试试 →"。

### 3.4 SportBreakdownChart（horizontal bar）

纯 div + tailwind（不需 SVG）。

每条 row：
```
[icon] [sport name (zh/en)]  [bar]██████   [count] / [minutes]m
```

bar 长度 = count / max(count) × 100%。
颜色：`bg-accent-primary` (top 1) → `bg-accent-primary/60` (top 2-3) → `bg-text-tertiary/30` (rest)。

最多 10 条。

无数据时显示 "还没运动记录"。

### 3.5 ArenaPieChart（半圆 / radial）

SVG 半圆 donut。

输入：`{wins, losses, battles_total, win_rate_pp}`。

绘制：
- 外圈：宽度 200x100 的半圆
- wins 弧（绿色 `accent-primary`）+ losses 弧（红色 `semantic-error`）
- 中心：大字号 "X%" win rate
- 下方：`{wins}W / {losses}L`，"出战 {battles_total}" 

无 battle 时：灰色半圆 + "还没出战"。

### 3.6 CardCollectionChart（4 行 stacked bar）

纯 div + tailwind。

每条 row：
```
[rarity color dot] [name]  [progress bar]  [owned] / [total]
```

bar 用 div + style.width，颜色按 rarity（common 灰 / rare 蓝 / epic 紫 / legendary 金）。

---

## 4. Sidebar 入口

加在"成就"之后：
```tsx
{ to: '/stats', key: 'nav.stats', icon: 'ti-chart-bar' }
```

---

## 5. i18n keys（约 18 个）

```
nav.stats
stats.section, stats.title, stats.summary_subline
stats.summary.workouts, .minutes, .xp, .level, .cards, .arena
stats.xp_trend.title, .avg_label, .empty
stats.sport_breakdown.title, .empty
stats.arena.title, .empty, .battles
stats.card_collection.title
```

---

## 6. 边缘情况

| 场景 | 处理 |
|---|---|
| 用户加入第一天，所有 stats 为 0 | summary 0 / 0 / 0；XP trend 全 0 显示 empty hint；sport empty hint；arena empty hint；card collection 显示 0/N |
| 30 天前没有任何 workout | XP trend 30 行全 0；图显示但平的 |
| Arena 0 出战 | win_rate_pp = 0；图显示灰色半圆 + "还没出战" |
| 卡牌池总数（v1 是 120 左右）| card_total_pool 跟 cards 表 count 同步，一旦表 seed 改动会自动反映 |
| 加入天数边界 | `current_date - created_at::date + 1`，第一天显示 "1 天" |
| 大量数据导致响应大 | get_user_stats 返回约 30 + 10 + 4 = 44 行数据 + 几个 scalar，远低于阈值，不需要分页 |

---

## 7. 验收标准

- [ ] Sidebar 加 "Stats" item，点击进入 `/stats`
- [ ] page 顶部显示 section + title + subline（加入 N 天 / 当前连击 / 历史最长）
- [ ] 6 个 summary tile 正确显示
- [ ] XP trend chart 渲染 30 天折线 + 平均线
- [ ] sport breakdown 渲染 top 10 + bar 长度比例
- [ ] arena pie 渲染胜率 + W/L
- [ ] card collection 4 行进度
- [ ] 全部 empty state 文案有
- [ ] tsc 干净，build 成功，所有 tests pass
- [ ] migration 15 push 成功

---

## 8. 工作量分解

| 阶段 | 估时 |
|---|---|
| migration 15 — get_user_stats RPC | 2h |
| types + hook | 0.5h |
| Stats page 骨架 + Sidebar 入口 + i18n | 1h |
| StatsSummary | 0.5h |
| XpTrendChart (SVG) | 1.5h |
| SportBreakdownChart (div) | 0.5h |
| ArenaPieChart (SVG donut) | 1h |
| CardCollectionChart (div) | 0.5h |
| smoke + bug fix | 1h |
| **总计** | **~8.5h ≈ 1 工作日** |

---

## 9. 不在 v1 范围

- 时间区间筛选（7/30/90 天切换）
- "AI 洞察"文本（被拒）
- CSV 导出
- 周对比 / 月对比卡片
- 趋势预测线
- 多人对比 stats（社交是后续 Day）
- 心率 / 配速等 fitness data（数据不存在）
