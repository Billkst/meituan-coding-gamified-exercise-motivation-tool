# Day 12 Plan — 战斗透明化 + 新人 NBA

**Spec：** [`../specs/2026-05-10-day12-battle-transparency-nba-design.md`](../specs/2026-05-10-day12-battle-transparency-nba-design.md)

## 实施顺序

按"backend → util → UI"，每子任务独立 commit + push（URL 持续可用）。

---

### Step 1 — battle util 扩展（advisor + simulator）

**文件：**
- `src/lib/battle/advisor.ts`：加 `recommendNextMove(state)` 返回 `{ phase, attacker_id?, target_id?, expected_damage?, reasoning_zh, reasoning_en }`
- `src/lib/battle/simulator.ts`（新建）：暴露 `previewDamage(state, atkId, defId): { actualDamage, triggers }`，内部不修改 state，调 `resolveAttack` 然后取 last log entry

**测试：**
- `src/lib/battle/__tests__/advisor.test.ts` 加 recommendNextMove 用例：pick_attacker / pick_target / 已结束
- `src/lib/battle/__tests__/simulator.test.ts`（新建）：previewDamage pure function 不污染 state

**commit：** `feat(day12): battle simulator + recommendNextMove advisor`

---

### Step 2 — CardSlot 升级（ability + buffs）

**文件：**
- `src/components/battle/CardSlot.tsx`：
  - 加 ability icon row（按 `ability_kind` 选 tabler icon）
  - 加 active_buffs 角标（数字 + glow）
  - 加 `damagePreview?: number | null` prop，显示在右上角的伤害徽章
  - 加 `recommended?: boolean` prop，开启时加金色 ring
- `src/lib/battle/abilityIcons.ts`（新建）：`ABILITY_ICON_MAP` + `ABILITY_LABEL_KEYS`
- `src/lib/i18n.ts`：加 `ability.damage_buff`, `ability.first_strike`, `ability.pierce`, `ability.shield`, `ability.reflect`, `ability.heal`, `ability.xp_bonus` × 2 langs

**commit：** `feat(day12): CardSlot shows ability icon + buffs + damage preview`

---

### Step 3 — BattleBoard 集成 damage preview + recommendation hint

**文件：**
- `src/components/battle/BattleBoard.tsx`：
  - 选 attacker 后预计算所有 target 的 preview map（`Record<defId, number>`）
  - 每张敌方 CardSlot 拿到 `damagePreview` 数字
  - 顶部加 `<RecommendationHint>` 横条
- `src/components/battle/RecommendationHint.tsx`（新建）：
  - 调 `recommendNextMove(state)` 拿建议
  - 渲染 "💡 推荐用 [卡名] 打 [卡名] → 预计 X 伤害"
  - 右侧"忽略" link 写 sessionStorage `pulse.battle.hide_hint=1`
  - 如果 sessionStorage 已设，整条隐藏
- `src/lib/i18n.ts`：加 `battle.hint.attacker_phase`, `battle.hint.target_phase`, `battle.hint.dismiss` 等 keys × 2

**commit：** `feat(day12): battle damage preview + recommendation hint`

---

### Step 4 — 战斗规则 modal

**文件：**
- `src/components/battle/BattleRulesModal.tsx`（新建）：
  - 一页 modal：目标 / 损伤公式 / 7 种能力
  - 复用 `IconInfoCircle` trigger
- `src/components/battle/BattleBoard.tsx`：右上加 info button
- `src/pages/Arena.tsx`：右上同样加（一致 trigger）
- `src/lib/i18n.ts`：加 `battle.rules.title`, `battle.rules.objective`, `battle.rules.formula`, `battle.rules.abilities_title`, plus reuse ability.* keys × 2

**commit：** `feat(day12): battle rules + abilities cheatsheet modal`

---

### Step 5 — Dashboard NBA 状态机

**文件：**
- `supabase/migrations/20260510000022_day12_nba_state.sql`（新建）：
  - `create function get_nba_state()` returns jsonb：counts (workouts, owned_cards, active_deck_size, pve_battle_count, active_friends_count, today_quests_unclaimed)
  - grants
- `src/api/nba.ts`（新建）：`useNbaState()` hook
- `src/components/dashboard/NextBestActionCard.tsx`（新建）：
  - 接 `useNbaState`，根据规则切换文案 + CTA
  - 渲染在 Dashboard 顶部（在 ReviveBanner 之上 / 之下取决于优先级，建议放 ReviveBanner 之下、DailyQuests 之上）
- `src/pages/Dashboard.tsx`：插入 NBA 卡片
- `src/lib/i18n.ts`：加 `nba.first_workout.*`, `nba.collect_cards.*`, `nba.build_deck.*`, `nba.first_pve.*`, `nba.first_friend.*`, `nba.daily_quests.*` × 2

**commit：** `feat(day12): Dashboard NBA — next-best-action by user state`

push 前先 push migration（用 CLAUDE.md 的 db-url 姿势）。

---

### Step 6 — Arena 选关页 deck preview

**文件：**
- `src/pages/Arena.tsx`：
  - 每个 NPC 卡变成可展开（保持 grid 布局，加 collapsible expand area）
  - 展开内容：NPC 的 8 张卡 mini list（name + atk/def）+ "你 vs 它"对比
  - 展开/折叠用 `<details>` 简化，或 controlled state
- `src/api/npcs.ts`：确认返回字段含 `deck_card_ids`，否则补
- `src/components/arena/NpcDeckPreview.tsx`（新建）：拿 deck card ids → resolve cards → 渲染
- `src/lib/i18n.ts`：加 `arena.npc.expand`, `arena.npc.advantage_yours`, `arena.npc.advantage_even`, `arena.npc.advantage_theirs`, `arena.npc.deck_atk`, `arena.npc.deck_def` × 2

**commit：** `feat(day12): Arena lobby NPC deck preview + advantage hint`

---

### Step 7 — 验收

```bash
bunx tsc --noEmit
bun run test
bun run build
```

`/browse` 手动 smoke：
- 重置 onboarding 状态（`?dev=1` → DEV drawer reset_onboarding）→ Dashboard：NBA 卡片显示"打第一次卡"
- 提交 1 次 workout → Dashboard：NBA 切到"继续抽卡"
- 抽到 8 张卡 → Dashboard：NBA 切到"组建主卡组"
- 组队 → Dashboard：NBA 切到"首战 Arena"
- /arena：每个 NPC 可展开 deck，胜率提示正确
- 进战斗：CardSlot 显示 ability icon + buffs；选 attacker 后所有 target 显示预计伤害；顶部建议条 + "忽略" 持久化
- 点 "i" → 规则 modal，覆盖 7 种能力
- /arena PVE 整轮 → result：现有功能不变
- /friends → start PVP → 同样的战斗 UI

---

## 涉及文件清单

| 文件 | 改动 |
|---|---|
| `src/lib/battle/advisor.ts` | + recommendNextMove |
| `src/lib/battle/simulator.ts` | 新建：previewDamage |
| `src/lib/battle/abilityIcons.ts` | 新建：icon map |
| `src/lib/battle/__tests__/advisor.test.ts` | 加 cases |
| `src/lib/battle/__tests__/simulator.test.ts` | 新建 |
| `src/components/battle/CardSlot.tsx` | + ability + buffs + damagePreview + recommended |
| `src/components/battle/BattleBoard.tsx` | + recommendation + preview map |
| `src/components/battle/RecommendationHint.tsx` | 新建 |
| `src/components/battle/BattleRulesModal.tsx` | 新建 |
| `src/components/dashboard/NextBestActionCard.tsx` | 新建 |
| `src/components/arena/NpcDeckPreview.tsx` | 新建 |
| `src/pages/Arena.tsx` | + collapsible NPC + info icon |
| `src/pages/Dashboard.tsx` | + NBA card |
| `src/api/nba.ts` | 新建：useNbaState |
| `src/api/npcs.ts` | 确认 deck_card_ids 返回 |
| `supabase/migrations/20260510000022_day12_nba_state.sql` | 新建：get_nba_state RPC |
| `src/lib/i18n.ts` | + ability + battle.hint + battle.rules + nba + arena.npc.* keys × 2 |

## 不动的文件

- 战斗机制（resolver / skills / store）— 不改，仅 UI 透明化
- 既有 RPC（submit_workout / start_battle / finalize_battle / start_pvp_battle）— 不动
- DESIGN.md 风格 token — 复用现有 rarity / glow / font 系统
