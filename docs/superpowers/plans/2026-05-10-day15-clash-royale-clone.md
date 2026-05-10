# Day 15-20 Plan — 实时塔防对战重制（皇室战争复刻）

**Spec：** [`../specs/2026-05-10-day15-clash-royale-clone-design.md`](../specs/2026-05-10-day15-clash-royale-clone-design.md)

**总览：** 5-6 天交付完整 Clash 模式 + meta 经济 + 健身联动闭环。Day 15 把数据基础打牢，Day 16 把 tick 引擎写完，Day 17-18 把战斗渲染 + AI 跑通，Day 19 经济 + meta UI，Day 20 i18n + 集成手测 + 部署。

每个 step 独立 commit + push（Vercel auto-deploys，URL 持续可用）。

---

## Day 15 — 数据基础设施（6-8h）

目标：跑完 Day 15，数据库、静态数据、meta store、API hooks 全部就绪。**没有任何 UI**——验收靠 dev tooling + tests。

### Step 1 — migration 24: cr_* schema + seed 12 张卡

**文件：** `supabase/migrations/20260510000024_day15_clash_schema.sql`

内容：
- `cr_cards` 表 + seed 12 张（数据见 spec §4）
- `cr_user_cards` 表（解锁 + 等级 + 碎片）
- `cr_user_decks` 表（8 张 cards[]）
- `cr_account_currency` 表（gold + shards_total）
- `cr_chests` 表（队列 + unlocks_at + rewards jsonb）
- `cr_match_log` 表（result + duration + towers + replay jsonb）
- RLS 5 个策略：`(user_id = auth.uid())`
- seed:
  - 12 张 `cr_cards` rows
  - `on user signup` trigger 触发 `cr_account_currency` 默认 100 gold + 自动解锁起始 4 张（knight/archer/goblin/arrows）
  - 自动建初始牌组 `[knight, archer, goblin, giant, musketeer, valkyrie, arrows, cannon]`（8 张）—— 但只有 4 张已解锁，未解锁的牌组卡灰显（手牌从已解锁的循环抽）

**测试：** push migration 后 `select * from cr_cards;` 返回 12 行；新建 user 后 `cr_account_currency.gold = 100`。

**commit：** `feat(day15): cr_* schema + 12 cards seed + initial unlock`

---

### Step 2 — migration 25: cr_* RPCs

**文件：** `supabase/migrations/20260510000025_day15_clash_rpcs.sql`

8 个 RPC：

```sql
cr_get_state() → jsonb
  -- 返回 { gold, shards_total, cards: [{id, unlocked, level, shards}], deck: text[], chests: [...] }

cr_unlock_card(p_card_id text) → jsonb
  -- 检查未解锁 + gold >= unlock_cost (10) → 扣 gold + 标记 unlocked + return {gold, card}

cr_upgrade_card(p_card_id text) → jsonb
  -- 查升级表 (cost_gold, cost_shards by level) + 检查满足 → 扣资源 + level+1 + return {gold, card}

cr_set_deck(p_card_ids text[]) → jsonb
  -- 校验 8 张 + 全部 unlocked → upsert deck

cr_finalize_match(p_result text, p_duration int, p_player_towers_lost int, p_ai_towers_lost int, p_difficulty text, p_replay jsonb) → jsonb
  -- 写 match_log + 计算金币 (win=30, draw=10, loss=5) + 检查连胜 + 队列宝箱
  -- return { gold_earned, chest_id?, win_streak }

cr_open_chest(p_chest_id uuid) → jsonb
  -- 检查 unlocks_at <= now() + opened=false → 开 + 发奖励 (gold + shards 随机分配到已解锁卡)
  -- return { gold, shards_breakdown: [{card_id, count}] }

cr_unlock_chest_now(p_chest_id uuid) → jsonb
  -- DEV 用，直接把 unlocks_at 设为 now()
  -- return success

cr_grant_workout_gold(p_xp int) → jsonb
  -- submit_workout RPC 内部调用：100 + xp*5 (cap 500) → 加到 gold
  -- return { gold_earned, gold_total }
```

升级成本表（plpgsql 内部函数）：
```
level | gold | shards
2     | 5    | 2
3     | 20   | 4
4     | 50   | 10
5     | 150  | 20
6     | 400  | 50
7     | 1000 | 100
8     | 2000 | 200
9     | 4000 | 400
10    | 8000 | 800
11    | 20000 | 1500
```

**测试：** dev_dispatch 跑一遍每个 RPC，验证返回结构。

**commit：** `feat(day15): cr_* 8 RPCs (state/unlock/upgrade/deck/match/chest/grant)`

---

### Step 3 — 静态卡数据 + 战场常量

**文件：**
- `src/clash/lib/cardData.ts`（新建）：12 张卡完整数据 + `scaleStatsForLevel(base, level)` 函数（线性 100% → 200%）
- `src/clash/lib/arena.ts`（新建）：战场尺寸常量、塔位、river、桥位置、轨道路径

```ts
// arena.ts
export const ARENA = {
  cols: 18,
  rows: 32,
  river: { yMin: 15, yMax: 17 },
  bridges: [{ x: 3 }, { x: 14 }],
  towers: {
    player_king:  { x: 8.5, y: 2,  hp: 4000, range: 7, hitSpeed: 1.0 },
    player_left:  { x: 3,   y: 5,  hp: 2400, range: 7, hitSpeed: 0.8 },
    player_right: { x: 14,  y: 5,  hp: 2400, range: 7, hitSpeed: 0.8 },
    enemy_king:   { x: 8.5, y: 30, hp: 4000, range: 7, hitSpeed: 1.0 },
    enemy_left:   { x: 3,   y: 27, hp: 2400, range: 7, hitSpeed: 0.8 },
    enemy_right:  { x: 14,  y: 27, hp: 2400, range: 7, hitSpeed: 0.8 },
  },
  tickHz: 30,
  matchSeconds: 180,
  overtimeSeconds: 60,
  elixirMaxNormal: 10,
  elixirRateNormal: 1 / 2.8,   // per second
  elixirRateOvertime: 1 / 1.4,
  elixirStart: 5,
} as const

// cardData.ts
export interface CrCardDef {
  id: string
  name_zh: string
  name_en: string
  card_type: 'troop' | 'spell' | 'building'
  cost: number
  rarity: 'common' | 'rare' | 'epic'
  emoji: string
  unlock_cost: number
  base: {
    hp?: number
    dmg?: number
    hit_speed?: number
    move_speed?: number
    range?: number
    target?: 'ground' | 'air+ground' | 'building'
    count?: number
    radius?: number    // for spells
  }
}

export const CR_CARDS: CrCardDef[] = [...12 张...]

export function scaleStatsForLevel(base: CrCardDef['base'], level: number) {
  const mult = 1 + (level - 1) * 0.1   // 1 -> 1.0, 11 -> 2.0
  return {
    ...base,
    hp: base.hp ? Math.round(base.hp * mult) : undefined,
    dmg: base.dmg ? Math.round(base.dmg * mult) : undefined,
  }
}
```

**测试：** `src/clash/__tests__/cardData.test.ts`：scaleStatsForLevel 5 用例（边界 + 中段）；CR_CARDS 12 行数据完整性。

**commit：** `feat(day15): clash card data + arena constants`

---

### Step 4 — meta store + API hooks

**文件：**
- `src/clash/store/useClashMetaStore.ts`（新建）：纯 Zustand，缓存 cr_get_state 结果，提供 selectors
- `src/clash/api/clashState.ts`（新建）：`useClashState()` (react-query 包 cr_get_state)
- `src/clash/api/clashCards.ts`（新建）：`useUnlockCard()`, `useUpgradeCard()`
- `src/clash/api/clashDeck.ts`（新建）：`useSetDeck()`
- `src/clash/api/clashChests.ts`（新建）：`useOpenChest()`, `useUnlockChestNow()` (dev only)
- `src/clash/api/clashMatch.ts`（新建）：`useFinalizeMatch()`

每个 hook 模式照抄现有 `src/api/submitWorkout.ts`：`supabase.rpc('cr_xxx' as never, args as never)`。Mutations 调 `qc.invalidateQueries(['clashState'])`。

**测试：** 编译 + 类型检查通过即可（运行时测试靠 Day 19 UI 集成）。

**commit：** `feat(day15): clash meta store + 5 API hooks`

---

### Step 5 — dev_dispatch 扩展（评审快进 + 调试）

**文件：** `supabase/migrations/20260510000026_day15_clash_dev_actions.sql`

向 `dev_dispatch(p_action, p_args)` 加 4 个新 action：

```
'grant_gold'             p_args = { amount: int }
'unlock_all_cr_cards'    无 args，立刻全部 12 张解锁 + 升到 5 级
'instant_open_chests'    无 args，把 cr_chests 全部 unlocks_at 设为 now()
'reset_clash'            无 args，清 cr_user_cards / cr_account_currency / cr_user_decks / cr_chests / cr_match_log
```

更新 `src/components/DevDrawer.tsx`：在现有 7 个 action 后加 4 个新 button + 翻译。

**测试：** 手测 dev drawer 4 个新 action。

**commit：** `feat(day15): dev_dispatch +4 clash actions (grant_gold, unlock_all, instant_chests, reset_clash)`

---

### Step 6 — submit_workout 联动金币

**文件：** `supabase/migrations/20260510000027_day15_workout_gold.sql`

修改 `submit_workout`：在原本 RPC 末尾加：

```sql
v_gold_earned := least(500, 100 + v_xp_gained * 5);
update cr_account_currency
   set gold = gold + v_gold_earned, updated_at = now()
 where user_id = v_user_id;

return jsonb_set(
  v_result,
  '{gold_earned}',
  to_jsonb(v_gold_earned)
);
```

`src/api/submitWorkout.ts`：result type 加 `gold_earned: number`。

`src/pages/Workout.tsx`：成功后的横幅加 "+N 💰 已到账" 行。

**测试：** dev mode 提交 1 次 workout → `select gold from cr_account_currency` 增加 100-500。

**commit：** `feat(day15): submit_workout grants 100-500 gold (XP-scaled)`

---

### Step 7 — i18n keys (Clash)

**文件：** `src/lib/i18n.ts` 加 keys × 2 langs：

```
clash.home.title
clash.home.subtitle
clash.home.battle_cta
clash.home.gold
clash.home.shards
clash.home.deck
clash.home.cards
clash.home.chests

clash.cards.unlock_cta
clash.cards.upgrade_cta
clash.cards.unlock_cost          (with {gold} placeholder)
clash.cards.upgrade_cost
clash.cards.level
clash.cards.locked
clash.cards.max_level

clash.deck.title
clash.deck.choose_8
clash.deck.locked

clash.chests.silver
clash.chests.gold
clash.chests.unlocks_in
clash.chests.open_now
clash.chests.queue_full

clash.match.elixir
clash.match.next_card
clash.match.timer_main
clash.match.timer_overtime
clash.match.victory
clash.match.defeat
clash.match.draw
clash.match.your_towers
clash.match.enemy_towers

clash.result.title_win
clash.result.title_loss
clash.result.title_draw
clash.result.gold_earned
clash.result.chest_earned
clash.result.streak
clash.result.replay
clash.result.continue
clash.result.home

clash.workout.gold_flash         (with {amount})

clash.dev.grant_gold
clash.dev.unlock_all
clash.dev.instant_chests
clash.dev.reset_clash

clash.cards.knight              ... 12 张卡名 zh/en
clash.cards.knight_desc         ... 12 张卡描述 zh/en
```

约 60 个 key × 2 langs = 120 行新增。

**commit：** `chore(day15): clash i18n keys (60 × zh/en)`

---

### Step 8 — Day 15 验收

```bash
bunx tsc --noEmit
bun run test
bun run build
```

push 全部 migrations (24-27)：

```bash
read -r -s -p "DB password: " SUPABASE_DB_PASSWORD
echo
export SUPABASE_DB_PASSWORD
ENC_PASS=$(python3 -c "import os, urllib.parse as u; print(u.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))")
SUPABASE_DB_URL="postgresql://postgres.hahxjtddwnqpklgftsgj:${ENC_PASS}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
bunx supabase db push --include-all --db-url "$SUPABASE_DB_URL"
```

Smoke test（dev mode）：
- DEV drawer → unlock_all_cr_cards → `select * from cr_user_cards where user_id=...` 返回 12 行 unlocked + level 5
- DEV drawer → instant_open_chests → 战斗后宝箱秒开
- DEV drawer → reset_clash → 一切归零
- 提交 1 次 workout → cr_account_currency.gold 增加

**Day 15 出口：** 数据库 + 静态数据 + meta store + API hooks 全部就绪，但**没有任何用户可见的 Clash UI**。Day 16 开始写引擎，Day 17 开始有 UI。

---

## Day 16 — tick 引擎（6-8h）

**目标：** 纯函数 reducer 跑得动，单测覆盖单位行为/寻路/伤害/AI。

**文件：**
- `src/clash/engine/types.ts`：`MatchState`, `Unit`, `Tower`, `Projectile`, `Action` 类型
- `src/clash/engine/tick.ts`：`reduceTick(state, dtMs): MatchState` 主 reducer
- `src/clash/engine/unit.ts`：状态机（spawn → walk → engage → attack → death）
- `src/clash/engine/pathfinding.ts`：`nextStep(unit, targets, arena): {x, y}` 直线 + 桥 detour
- `src/clash/engine/targeting.ts`：`pickTarget(unit, allUnits, allTowers): id | null`，按 target_type + range + distance 优先级
- `src/clash/engine/damage.ts`：`applyDamage(state, attackerId, targetId): MatchState`，含 splash
- `src/clash/engine/ai.ts`：`aiDecide(state, difficulty): Action | null`

**测试：** 4 个文件 × 5-7 用例 = 25-30 用例：
- `tick.test.ts`：spawn 单位 → 1s 后 walk；2 单位接战 → HP 减少；公主塔死 → 王塔激活
- `pathfinding.test.ts`：左路单位走桥 (x=3)；空中单位直线
- `damage.test.ts`：单体；女武神 splash 命中 3 个
- `ai.test.ts`：normal 难度 elixir<6 不出牌；玩家空中单位 +反制概率

**commits：**
- `feat(day16): clash engine types + tick reducer`
- `feat(day16): clash unit state machine + pathfinding`
- `feat(day16): clash targeting + damage (single/splash)`
- `feat(day16): clash AI decision (3 difficulty tiers)`

---

## Day 17 — 战场渲染 + 拖拽部署（8-10h）

**目标：** ClashMatch 页能玩——视觉单位移动、点击对战钮 → 进战场 → 拖卡 → 部队走过去打塔 → AI 简单反应。但 AI 可能很弱、平衡未调。

**文件：**
- `src/clash/pages/ClashMatch.tsx`：主战斗页，挂 `useClashEngine()` hook（tick loop）
- `src/clash/components/Battlefield.tsx`：DOM 战场容器（grid + 河道 + 桥），尺寸自适应
- `src/clash/components/Tower.tsx`：6 座塔渲染 + HP bar
- `src/clash/components/Unit.tsx`：单位 sprite (emoji + 圆底 + HP bar)
- `src/clash/components/Hand.tsx`：手牌 4 张 + next preview
- `src/clash/components/ElixirBar.tsx`：充能动画
- `src/clash/components/TimerBar.tsx`：3 分钟倒计时 + 加时切换
- `src/clash/components/DragLayer.tsx`：拖拽预览
- `src/clash/components/DeployZone.tsx`：你方半区高亮
- `src/clash/components/DamageNumber.tsx`：飘字
- `src/clash/hooks/useClashEngine.ts`：包 reduceTick 到 requestAnimationFrame
- `src/clash/hooks/useDragDeploy.ts`：拖拽手牌 → 战场坐标转换

**commits：**
- `feat(day17): ClashMatch page scaffolding + engine hook`
- `feat(day17): Battlefield + Tower + Unit DOM rendering`
- `feat(day17): Hand + ElixirBar + TimerBar UI`
- `feat(day17): drag-deploy + deploy zone`
- `feat(day17): damage numbers + HP transitions`

---

## Day 18 — AI 闭环 + 战后结算（6-8h）

**目标：** 完整一局从开打到结算。

**文件：**
- `src/clash/engine/matchEnd.ts`：胜负判定（即时破王塔 / 主战结束 / 加时 / 平局）
- `src/clash/pages/ClashResult.tsx`：胜负 + 金币 + 宝箱奖励
- `src/clash/components/MatchEndBanner.tsx`：VICTORY/DEFEAT 横幅动画
- `src/clash/store/useClashMatchStore.ts`：实时 match state（用于跨组件读 + replay 收集）
- `src/clash/hooks/useAiOpponent.ts`：把 ai.ts 包成 200ms tick 的 effect

集成 `cr_finalize_match` RPC：战斗结束时调用，拿到 gold/chest 后跳到 ClashResult。

**commits：**
- `feat(day18): match end detection + victory banner`
- `feat(day18): AI opponent loop + difficulty selection`
- `feat(day18): ClashResult page + finalize_match integration`

---

## Day 19 — 经济 + meta UI（6-8h）

**目标：** ClashHome / ClashCards / ClashDeck / ClashChests 全部能用。

**文件：**
- `src/clash/pages/ClashHome.tsx`：主菜单（金币、宝箱队列、对战大按钮、四宫格 nav）
- `src/clash/pages/ClashCards.tsx`：卡片网格 + 解锁/升级 modal
- `src/clash/pages/ClashDeck.tsx`：8 张当前 + 已解锁池 + swap
- `src/clash/pages/ClashChests.tsx`：宝箱队列 + 倒计时 + 立即开
- `src/clash/components/ChestSlot.tsx`、`CardCollectionTile.tsx`、`DeckSlot.tsx`
- `src/clash/components/NextBestActionClash.tsx`：替换原 NextBestAction，提示"打卡 → 金币 → 解锁"
- 路由 `src/App.tsx`：把 `/arena` 整体替换为 `/clash`，旧 `/arena/*` 路由 redirect 到 `/legacy/arena/*`

**commits：**
- `feat(day19): ClashHome main menu + chest queue display`
- `feat(day19): ClashCards collection + unlock/upgrade UI`
- `feat(day19): ClashDeck builder (8-card swap)`
- `feat(day19): NBA card replaced with workout-to-gold loop`
- `chore(day19): archive old arena to /legacy + reroute /arena → /clash`

---

## Day 20 — 集成 + 部署（4-6h）

**目标：** 跑通端到端 + 部署上线。

工作：
- 翻译 keys 校对 (zh + en)
- ClashMatch 首次进入 spotlight tour（3 步：elixir / 拖卡 / 计时器）
- ClashHome 首次进入 spotlight（3 步：金币 / 宝箱 / 对战）
- 调平衡（normal 难度评审能赢得不太轻松也不太难）
- 移动端拖拽手测（iPhone 12 mini 视口）
- 桌面手测 (1080p)
- DESIGN.md 一致性检查
- `bunx tsc --noEmit && bun run test && bun run build` 全 green
- `git push` → Vercel 自动部署
- 评审 URL 五分钟体验全流程

**commits：**
- `feat(day20): clash spotlight tours (home + match)`
- `chore(day20): clash i18n polish + balance tuning`
- `chore(day20): final integration test + deploy`

---

## 涉及文件清单（全工程）

### 新建（51 个）

**migrations (4)：**
- `20260510000024_day15_clash_schema.sql`
- `20260510000025_day15_clash_rpcs.sql`
- `20260510000026_day15_clash_dev_actions.sql`
- `20260510000027_day15_workout_gold.sql`

**src/clash/lib/ (3)：** cardData.ts, arena.ts, i18nKeys.ts (合并到 lib/i18n.ts)

**src/clash/engine/ (7)：** types.ts, tick.ts, unit.ts, pathfinding.ts, targeting.ts, damage.ts, ai.ts, matchEnd.ts

**src/clash/store/ (2)：** useClashMetaStore.ts, useClashMatchStore.ts

**src/clash/api/ (5)：** clashState.ts, clashCards.ts, clashDeck.ts, clashChests.ts, clashMatch.ts

**src/clash/hooks/ (3)：** useClashEngine.ts, useDragDeploy.ts, useAiOpponent.ts

**src/clash/pages/ (5)：** ClashHome.tsx, ClashMatch.tsx, ClashResult.tsx, ClashCards.tsx, ClashDeck.tsx, ClashChests.tsx

**src/clash/components/ (12)：** Battlefield, Tower, Unit, Hand, ElixirBar, TimerBar, DragLayer, DeployZone, DamageNumber, MatchEndBanner, ChestSlot, CardCollectionTile, DeckSlot, NextBestActionClash

**src/clash/__tests__/ (6)：** cardData.test.ts, tick.test.ts, pathfinding.test.ts, damage.test.ts, ai.test.ts, matchEnd.test.ts

### 修改

- `src/lib/i18n.ts`：+ ~60 个 zh/en keys
- `src/components/DevDrawer.tsx`：+ 4 个 dev actions
- `src/api/submitWorkout.ts`：result type + gold_earned
- `src/pages/Workout.tsx`：完成横幅加 "+N 💰"
- `src/App.tsx`：路由调整（/arena → /clash，旧 routes → /legacy）

### 归档（移到 src/legacy/，不删）

- `src/pages/Arena.tsx → legacy/pages/Arena.tsx`
- `src/pages/ArenaBattle.tsx → legacy/pages/ArenaBattle.tsx`
- `src/pages/ArenaResult.tsx → legacy/pages/ArenaResult.tsx`
- `src/components/battle/* → legacy/battle/`
- `src/api/battles.ts, pvpBattle.ts → legacy/api/`

---

## 不动的文件

- `users` 表、`current_streak / freeze_xp_until / revive_streak` RPC
- `friends` 表、`friendships` RPC
- `achievements` / `quests` 表（Day 19 后会加 Clash 系列任务，但 schema 不动）
- `sports` 表 + `submit_workout` 的核心逻辑（仅扩展返回值）
- 旧的 `cards / user_cards / decks` 表（保留为图鉴）
- DESIGN.md 视觉规范（accent-primary 绿、display 字体、subtle glow）
- onboarding flow（Step1-3 不动；Step4 改为发 600 金币而非抽卡）

---

## 风险 & 备案

| 风险 | 触发 | 备案 |
|---|---|---|
| Day 17 拖拽在 mobile 不顺 | 长按 + 拖动落点不准 | Day 17 末改为 click+click 两段（先选卡，点战场） |
| Day 18 AI 太弱/太强 | 评审秒赢或秒输 | 默认 normal + 战前难度选；spec §15 已写 |
| Day 19 时间不够 | meta UI 写不完 | 砍 ClashChests（用 toast 立即结算），保 ClashHome + Cards + Deck |
| Day 20 部署 build 失败 | clash/ 目录引入新依赖 | 不引新依赖；Tailwind/Zustand/RQ 都是现有的 |
| migrations 24-27 push 失败 | WSL2 IPv4 | 沿用 spec §15 + CLAUDE.md 的 pooler URL 套路 |
| 单位寻路 bug 难调 | 部队卡在桥头 / 抖动 | tick.test.ts 提前覆盖 + 加 `lastTargetId` 抗抖动 |

---

## 进度跟踪

每个 Day 的 commit 末尾打 `Day N - DONE`。如果 Day N 跨夜或被打断，下次进入前先 read 这份 plan 的对应 section。

Day 15 起步信号：开始 Step 1 — migration 24。
