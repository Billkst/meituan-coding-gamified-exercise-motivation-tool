# Day 5 — Arena 对战 设计文档

**日期**：2026-05-10
**作者**：Claude（与用户对齐）
**状态**：设计已确认，待实施

---

## 0. 摘要

实现 PULSE 测评作业的 Day 5：完整 PVE 对战循环。覆盖 8 张卡组构筑、回合制战斗（玩家手动下令）、AI 决策、技能引擎、Arena 阶梯、段位 + 奖励。架构走 **客户端权威 + 单点 RPC**：战斗状态机和技能引擎跑在浏览器，Supabase 只在战斗开始/结束各调一次 RPC。

成功标准：
- 用户从 Dashboard 可一键进 Arena
- 必须先在 /deck 构筑 8 张主卡组才能开战
- 选 NPC 后进入棋盘式战斗页，8 回合手动出牌 + AI 自动应招
- 8 回合走完后判 HP 总和决定胜负
- 胜利 +XP +段位 score；败北 0 奖励但战斗记录保留
- 40 张卡的 ability_text 全部映射到 8 种 ability_kind 中并在战斗中生效
- Advisor 智能推荐能基于玩家卡库给出"最优 8 张" + 理由

---

## 1. 数据模型扩展

### 1.1 `cards` 表加 3 列

```sql
alter table public.cards
  add column ability_kind text check (ability_kind in (
    'damage_buff','defense_buff','heal','shield',
    'pierce','reflect','first_strike','xp_bonus'
  )),
  add column ability_value int not null default 0,
  add column ability_trigger text check (ability_trigger in (
    'on_play','on_attack','on_defend','on_battle_end','passive'
  ));
```

40 张卡的 ability 映射在 migration 7 里一次性 update。每张卡的 `ability_text_zh/en` 文案保留不变。

**典型映射示例**（完整 40 行 update 在 migration 中给出）：

| card_id | ability_text_zh | kind | trigger | value |
|---------|------|------|---------|-------|
| `c_sprint` | 速度 +5% | first_strike | on_attack | 5 |
| `c_strength` | 高 ATK 低 DEF | pierce | on_attack | 0 |
| `c_breath` | 回血 +2/turn | heal | on_battle_end | 2 |
| `c_block` | 减伤 +5% | defense_buff | on_defend | 5 |
| `c_warmup` | 入场前缓冲 | shield | on_play | 3 |
| `r_combo` | 连续命中 +1 ATK | damage_buff | on_attack | 1 |
| `r_counter` | 受击反伤 +30% | reflect | on_defend | 30 |
| `r_recovery` | 回合结束回血 +5 | heal | on_battle_end | 5 |
| `r_explosive` | 首回合双倍 ATK | first_strike | on_attack | 22 |
| `e_runner_high` | 心流叠加 +50% XP | xp_bonus | on_battle_end | 50 |
| `e_apex` | 段位首战双倍奖励 | xp_bonus | on_battle_end | 100 |
| `l_pulse` | 所有运动协同 +25% | damage_buff | passive | 25 |

### 1.2 新表 `npc_opponents`

```sql
create table public.npc_opponents (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  level int not null check (level between 1 and 8),
  deck_card_ids text[] not null check (array_length(deck_card_ids, 1) = 8),
  reward_xp int not null check (reward_xp >= 0),
  unlock_at_level int not null default 1,
  flavor_zh text,
  flavor_en text
);
```

8 个 NPC seed，难度从全 common 起渐升到含 epic/legendary 的最终 BOSS。

### 1.3 `battles` 表加 2 列

```sql
alter table public.battles
  add column npc_id text references public.npc_opponents(id),
  add column log jsonb;
```

`log` 存 8 回合每回合的完整数据（attacker/defender card id、伤害、HP 变化、触发的技能列表）。

### 1.4 RLS

- `npc_opponents`：public read（anon + authenticated），无 insert/update/delete policy
- `battles`：
  - `select` policy：`attacker_id = auth.uid() OR defender_id = auth.uid()`
  - 无 `insert` / `update` / `delete` policy → 客户端无法直接写；只有 `start_battle` / `finalize_battle` RPC（`security definer`）能写
  - 注意：`security definer` 函数绕过 RLS，但函数自身要校验 `auth.uid()`

---

## 2. RPC 签名

### 2.1 `start_battle(p_npc_id text) → jsonb`

```jsonc
// 输出
{
  "battle_id": 142,
  "attacker_deck_ids": ["c_sprint","c_endurance",...8 张],
  "defender_deck_ids": ["c_strength","r_combo",...8 张],
  "reward_xp": 60,
  "npc_name_zh": "宿舍恶魔",
  "npc_name_en": "Dorm Demon",
  "npc_level": 3
}
```

校验：
- `auth.uid()` 必须存在
- 玩家 active deck 必须正好 8 张
- 玩家 level ≥ npc.unlock_at_level
- npc_id 存在
- 失败 → `raise exception` with `errcode='22023'`

成功 → 写一行 battles（winner_id=null, log=null），返回 NPC 信息。

### 2.2 `finalize_battle(p_battle_id bigint, p_log jsonb) → jsonb`

```jsonc
// 输出
{
  "result": "win" | "lose",
  "xp_gained": 60,            // 含 xp_bonus 加成的最终值
  "base_reward_xp": 50,       // npc.reward_xp 原值（前端展示加成 % 用）
  "final_attacker_hp": 87,
  "final_defender_hp": 64,
  "new_season_score": 245,
  "score_milestone_crossed": false  // 是否跨百位（用于触发高光特效）
}
```

校验：
- `auth.uid()` 必须存在
- `battles.attacker_id = auth.uid()`（防别人结算别人的战斗）
- `battles.winner_id is null`（不重复结算）
- `jsonb_array_length(p_log) = 8`
- v1 信任 client 报告的 final HP 判胜（PVE 单机，作弊只伤自己）
- v2 留 Day 6 加 deep replay 校验

成功（胜利时）的 XP 计算：
1. `base_xp := npc.reward_xp`
2. `xp_bonus_total := sum of all (xp_bonus kind, on_battle_end trigger) values from attacker_deck` — 服务器扫 `attacker_deck_ids`，join cards 表，加总 `ability_value` where `ability_kind='xp_bonus'`
3. `xp_gained := round(base_xp * (1 + xp_bonus_total / 100))`
4. `users.xp += xp_gained`，`users.season_score += xp_gained / 4`
5. `score_milestone_crossed := floor(old_score/100) < floor(new_score/100)`

写 battles.winner_id/log/attacker_xp_delta = xp_gained。

败北：xp_gained = 0，仅写 battle log，不动 users。

---

## 3. 路由流

```
/dashboard
  └→ "前往对战" → /arena

/arena (Lobby)
  ├ 段位 banner
  ├ NPC 阶梯（8 卡片，未达 level 灰锁）
  ├ "我的卡组" 入口 → /deck
  └ 点击 NPC → start_battle RPC → /arena/battle/:battleId

/arena/battle/:battleId (Battle, client-side)
  ├ 双方 8 张棋盘
  ├ 玩家点己方卡 → 高亮 → 点敌方卡 → 出牌动画 → AI 应招
  ├ 8 回合走完 → finalize_battle RPC
  └ 跳 /arena/result/:battleId

/arena/result/:battleId (Result)
  ├ 胜负屏 + XP + 段位变化
  ├ 战斗回放（log replay）
  └ "再战" / "回大厅" / "回 Dashboard"

/deck (DeckBuilder)
  ├ 8 槽位（点选/移除）
  ├ 卡库筛选（按稀有度 / 已拥有 / 星级）
  ├ Advisor 推荐按钮
  └ "保存" → upsert decks
```

---

## 4. 技能引擎

### 4.1 8 种 `ability_kind` 语义

| kind | 触发时机 | 效果 |
|------|----------|------|
| `damage_buff` | `on_attack` | 本卡攻击时 + value 绝对伤害（如 r_combo +1） |
| `damage_buff` | `passive` | 本方所有攻击 × (1 + value/100) 百分比加成（如 l_pulse +25%） |
| `defense_buff` | `on_defend` | 受击 DEF + value |
| `heal` | `on_battle_end` 或 `on_play` | 回 value HP |
| `shield` | `on_play` | 出场时给所有友方 +value DEF（buff 整场生效，`expires_after_turn = -1`） |
| `pierce` | `on_attack` | 攻击无视目标 DEF |
| `reflect` | `on_defend` | 反弹 value% 伤害给攻方 |
| `first_strike` | `on_attack` | 当 `state.turn ≤ 3` 时，攻击 +value ATK；其余回合无效 |
| `xp_bonus` | `on_battle_end` | 战斗胜利时奖励 XP +value% |

### 4.2 类型与数据结构

```typescript
// src/lib/battle/types.ts
export type AbilityKind = 'damage_buff' | 'defense_buff' | 'heal' | 'shield'
                       | 'pierce' | 'reflect' | 'first_strike' | 'xp_bonus'

export type AbilityTrigger = 'on_play' | 'on_attack' | 'on_defend'
                          | 'on_battle_end' | 'passive'

export interface BattleCard {
  card: Card                 // 原 cards 表行
  star_level: number         // 1..5（玩家方来自 user_cards；NPC 方默认 1）
  current_hp: number         // 单卡 HP（用于残血必杀类技能）
  is_alive: boolean
  is_played: boolean         // 本场已出过
  active_buffs: Buff[]       // 临时 buff 队列
}

export interface Buff {
  source_card_id: string
  kind: AbilityKind
  value: number
  expires_after_turn: number  // -1 = 整场
}

export interface BattleState {
  battle_id: number
  turn: number                          // 1..8（结算后到 9）
  attacker_hp: number                   // "卡组血量" = 100 起
  defender_hp: number                   // 100
  attacker_cards: BattleCard[]          // 8 张
  defender_cards: BattleCard[]          // 8 张
  current_phase:
    | 'init'
    | 'pick_attacker'
    | 'pick_target'
    | 'animating_player'
    | 'ai_thinking'
    | 'pick_ai'
    | 'animating_ai'
    | 'finalizing'
    | 'ended'
  selected_attacker_id: string | null
  log: BattleLogEntry[]
  passive_buffs: Buff[]                 // 整场生效的（如 PULSE）
}

export interface BattleLogEntry {
  turn: number
  attacker_card_id: string
  defender_card_id: string
  raw_damage: number
  actual_damage: number
  attacker_hp_after: number
  defender_hp_after: number
  triggers_fired: { card_id: string; kind: AbilityKind; effect: string }[]
}
```

### 4.3 `resolveAttack` pure function

```typescript
// src/lib/battle/resolver.ts
export function resolveAttack(
  state: BattleState,
  atkSide: 'attacker' | 'defender',
  atkId: string,
  defId: string,
): BattleState {
  // 1. 基础伤害 = ATK × 星级加成 (1 + 0.2*(star-1))
  // 2. 双方 passive 加成（PULSE +25%）
  // 3. atk 自身 on_attack 加成（damage_buff）
  // 4. 减伤（除非 pierce）：max(1, dmg - effectiveDef)
  // 5. def 自身 on_defend（reflect 反弹）
  // 6. 写 log entry
  // 7. 返回新 state
}

function effectiveDefense(card: BattleCard, state: BattleState): number {
  // base_defense + buffs of kind 'defense_buff' / 'shield'
}
```

### 4.4 触发优先级（确定性）

- 同回合多 trigger：`passive → on_play → on_attack → on_defend → on_battle_end`
- 同 trigger 多卡：rarity desc → star desc → card.id asc

### 4.5 边界规则

- 每卡每场只出 1 次（8 回合用满 8 张）
- HP 系统：每方初始 100；单卡 current_hp 仅用于残血触发；判胜按双方 8 回合后 HP 总和
- 攻击力 ≤ 0 兜底 1 点（保证战斗推进）
- `first_strike` 实现为 `on_attack` + 条件 `state.turn ≤ 3` → +value ATK；非"出牌顺序"（产品可见胜过隐藏机制）
- **`on_play` 触发时机**：战斗 init 阶段（turn=1 之前）一次性扫描双方所有 8 张卡，按"稀有度高 → 星级高 → id asc"顺序执行；产生的 buff 默认整场生效（`expires_after_turn = -1`），除非该 kind 在 4.1 表格里另行规定
- **passive trigger** 不是"事件"而是"持续条件"：每次 resolveAttack 时实时扫描双方场上所有 passive 卡，把 buff 累加到本次结算
- **战斗内单卡 ATK/DEF 字段**永远引用 `card.base_attack/base_defense` × 星级加成，不被 buff 直接修改；buff 体现在 `effectiveDefense()` 和伤害 pipeline 计算时叠加

---

## 5. 战斗状态机

### 5.1 单回合流转

```
'init'
  → 'pick_attacker'        (玩家点己方未出过的卡)
  → 'pick_target'          (玩家点敌方任一卡)
  → 'animating_player'     (播 800ms)
  → 'ai_thinking'          (停 300ms)
  → 'pick_ai'              (AI 选卡 + 攻击)
  → 'animating_ai'         (播 800ms)
  → turn++
  → 'pick_attacker' (loop)
  → turn === 9 → 'finalizing' → 'ended'
```

每回合 ≈ 1.6 秒动画 + 玩家思考时间，8 回合约 30 秒一局。

### 5.2 zustand store

```typescript
// src/store/useBattleStore.ts
interface BattleStore {
  state: BattleState | null

  initBattle(battleId: number, playerDeck: BattleCard[], npcDeck: BattleCard[]): void
  selectAttacker(cardId: string): void   // phase === 'pick_attacker'
  selectTarget(cardId: string): void     // phase === 'pick_target' → resolveAttack
  runAITurn(): void                      // phase === 'pick_ai'
  endTurn(): void                        // animating_ai 结束 → turn++
  finishBattle(): Promise<FinalizeResult>  // turn === 9 → call RPC
  reset(): void
}
```

`resolveAttack` 是 pure function，可单元测。store 只协调 phase 转移和动画时序。

---

## 6. AI 决策（启发式）

```typescript
// src/lib/battle/ai.ts
export function aiPickAttacker(state: BattleState): string {
  const candidates = state.defender_cards.filter(c => !c.is_played)
  return candidates
    .map(c => ({
      id: c.card.id,
      score:
        c.card.base_attack * (1 + 0.2 * (c.star_level - 1))
        + (c.card.ability_kind === 'first_strike' && state.turn <= 3 ? 8 : 0)
        + (c.card.ability_kind === 'pierce' ? 6 : 0),
    }))
    .sort((a, b) =>
      b.score - a.score || a.id.localeCompare(b.id)  // 同分按 id 字典序
    )[0].id
}

export function aiPickTarget(state: BattleState, attackerId: string): string {
  const candidates = state.attacker_cards.filter(c => !c.is_played)
  return candidates
    .map(c => ({
      id: c.card.id,
      score: -c.card.base_defense + c.current_hp * 0.3,
    }))
    .sort((a, b) =>
      b.score - a.score || a.id.localeCompare(b.id)
    )[0].id
}
```

NPC 的难度差异通过 deck 强度体现，不是通过 AI 智商。后续若加难度差，引入 `npc.ai_skill: 0..1` 按概率掺入随机即可。

---

## 7. UI 组件分解

### 7.1 文件清单

```
src/
├── api/
│   ├── battles.ts          NEW: useStartBattle, useFinalizeBattle, useBattle
│   ├── deck.ts             NEW: useActiveDeck, useSaveDeck
│   └── npcs.ts             NEW: useNpcOpponents (with unlock state)
│
├── lib/battle/
│   ├── types.ts            NEW
│   ├── resolver.ts         NEW: resolveAttack pure fn
│   ├── skills.ts           NEW: 8 ability_kind effect map
│   ├── ai.ts               NEW: aiPickAttacker, aiPickTarget
│   ├── advisor.ts          NEW: recommendDeck
│   └── __tests__/          NEW: 3 test files
│
├── store/
│   └── useBattleStore.ts   NEW: zustand store
│
├── pages/
│   ├── Arena.tsx           IMPL (was placeholder)
│   ├── ArenaBattle.tsx     NEW
│   ├── ArenaResult.tsx     NEW
│   └── DeckBuilder.tsx     IMPL (was placeholder)
│
└── components/
    ├── battle/
    │   ├── BattleBoard.tsx
    │   ├── CardSlot.tsx
    │   ├── DamageFloat.tsx
    │   ├── TurnIndicator.tsx
    │   └── BattlePhaseBanner.tsx
    └── deck/
        ├── DeckSlots.tsx
        ├── CardPicker.tsx
        └── AdvisorButton.tsx

supabase/migrations/
└── 20260510000007_arena_extend.sql
    ├ alter cards add ability_kind/value/trigger
    ├ update cards × 40 (ability mapping)
    ├ create npc_opponents + 8 row seed
    ├ alter battles add npc_id/log
    ├ rpc start_battle
    ├ rpc finalize_battle
    └ rls policies for npc_opponents + battles update
```

### 7.2 三页面骨架

**`/arena` (Lobby)：**
- 顶部：玩家 banner（icon + season_score 大字 + W/L 计数）；v1 不引入命名段位（青铜/白银/...），用 season_score 数字本身排序
- 中部：NPC 阶梯 grid（8 卡片，每张：name + level + reward_xp + 锁定状态 + flavor）
- 底部："我的卡组 →" 入口
- 状态：active deck < 8 张时禁用所有 NPC 点击 + 显眼 banner 引导

**`/arena/battle/:battleId` (Battle)：**
- 上区：NPC 名 + HP 条
- 上半棋盘：NPC 8 张卡（可点击为 target，已 played 灰显）
- 中央：回合指示 + phase banner ("Turn 3/8 · 选攻击者")
- 下半棋盘：玩家 8 张卡（可点击为 attacker）
- 下区：玩家 HP 条
- 浮层：DamageFloat 飘字 + 技能名 banner

**`/arena/result/:battleId` (Result)：**
- 全屏 VICTORY/DEFEAT 字 + 霓虹特效（按 DESIGN.md 风格）
- 中部：+XP / 段位变化 / W/L 增量
- 底部：8 行 log 缩略回放
- 按钮：再战 / 回 Arena / 回 Dashboard

### 7.3 高光时刻

- legendary 出场：整屏一闪 + 卡放大慢动作 + 金色粒子 0.6s
- pierce 命中：飘字 "PIERCE" + 红色波纹
- reflect 反弹：双向飞箭动画
- season_score 跨百位（旧 score < n×100 ≤ 新 score）：result 页全屏霓虹爆点 + score 数字滚动动画

按 DESIGN.md 定的霓虹/黑底/单色调走，不滥用粒子。

---

## 8. Advisor 推荐算法

```typescript
// src/lib/battle/advisor.ts
const RARITY_BONUS: Record<Rarity, number> = {
  common: 0, rare: 5, epic: 12, legendary: 25,
}

export function recommendDeck(myCards: OwnedCard[]): {
  deck: string[]
  reasoning_zh: string
  reasoning_en: string
} {
  const scored = myCards.map(oc => ({
    id: oc.card_id,
    score:
      (oc.card.base_attack + oc.card.base_defense)
      * (1 + 0.2 * (oc.star_level - 1))
      + RARITY_BONUS[oc.card.rarity]
      + oc.card.synergy_with.length * 1,
  })).sort((a, b) => b.score - a.score)

  const deck = scored.slice(0, 8).map(s => s.id)
  return { deck, ...buildReasoning(deck, myCards) }
}

function buildReasoning(deck: string[], myCards: OwnedCard[]) {
  const cards = deck.map(id => myCards.find(o => o.card_id === id)!)
  const legendaryN = cards.filter(c => c.card.rarity === 'legendary').length
  const epicN      = cards.filter(c => c.card.rarity === 'epic').length
  const synergyN   = countSynergyChains(cards)
  const avgStar    = cards.reduce((s, c) => s + c.star_level, 0) / 8

  // 模板拼接：示例输出
  // zh: "高强度卡组：含 legendary ×1 + epic ×2 · 协同链 ×3 · 平均 ★3.2"
  // en: "High-tier deck: legendary ×1 + epic ×2 · synergy chains ×3 · avg ★3.2"
  return {
    reasoning_zh: `${legendaryN > 0 || epicN >= 2 ? '高强度卡组' : '稳健卡组'}：`
      + `${legendaryN > 0 ? `legendary ×${legendaryN} · ` : ''}`
      + `${epicN > 0 ? `epic ×${epicN} · ` : ''}`
      + `协同链 ×${synergyN} · 平均 ★${avgStar.toFixed(1)}`,
    reasoning_en: `${legendaryN > 0 || epicN >= 2 ? 'High-tier' : 'Solid'} deck: `
      + `${legendaryN > 0 ? `legendary ×${legendaryN} · ` : ''}`
      + `${epicN > 0 ? `epic ×${epicN} · ` : ''}`
      + `synergy chains ×${synergyN} · avg ★${avgStar.toFixed(1)}`,
  }
}
```

UI：用户点 "ADVISOR 推荐" → 弹层显示推荐 8 张 + reasoning ("强 ATK 输出 / 高防御核心 / 协同链 ×3") → "采用" 或 "取消"。

---

## 9. 错误处理

| 场景 | 处理 |
|------|------|
| `start_battle` deck 不足 8 张 | Lobby 端预防：banner + 禁用 NPC 点击 + 跳 /deck |
| `start_battle` level 不足 | NPC 卡片在 Lobby 端就显示锁形状不让点 |
| 战斗中页面 refresh | v1 简化：refresh 直接判输回 lobby（未来 zustand persist 恢复） |
| `finalize_battle` 网络失败 | 自动 retry × 3；仍失败 → toast + battle.winner_id 留空（用户可重进 result 页拉数据） |
| `finalize_battle` already_finalized | 服务器返 idempotent 结果，client 直接渲染 |
| 玩家中途关浏览器 | battle 行残留 winner_id=null；不发奖；下次进 /arena 提示"上一场未结算" |
| RLS 防泄露 | battles 表 select RLS：`attacker_id = auth.uid() OR defender_id = auth.uid()` |

---

## 10. 测试策略

### 10.1 单元测试（Vitest）

`src/lib/battle/__tests__/resolver.test.ts` — **12 case**：
1. 基础 ATK 14 vs DEF 8 = 6 点伤害
2. 星级加成：ATK 20 ★3 = 28 点
3. pierce 无视 DEF
4. reflect 30% 反弹
5. first_strike turn=1 触发 +5 ATK
6. shield 给全军 +DEF 一回合
7. heal on_battle_end +5 HP
8. damage_buff on_attack +5
9. damage_buff passive +25%（PULSE 满场）
10. 攻击力 ≤ 0 兜底 1 点
11. 同时多 buff 优先级
12. xp_bonus on_battle_end 不影响战斗结算只影响奖励

`src/lib/battle/__tests__/ai.test.ts` — **5 case**：
- aiPickAttacker 选最高分
- first_strike 在 turn ≤ 3 加分
- 跳过已 played 卡
- aiPickTarget 选最低 DEF
- 同分卡按 id 字典序（确定性）

`src/lib/battle/__tests__/advisor.test.ts` — **3 case**：
- 不足 8 张返回全部
- 优先高星
- synergy 加分生效

`src/lib/battle/__tests__/full-game.test.ts` — **2 case**（端到端纯逻辑）：
- 用 fixture deck（玩家全 ★1 common + NPC 全 ★1 common）跑完 8 回合，断言 `state.phase === 'ended'` 且 log 长度 = 8
- 极端 deck（玩家含 PULSE + epic ×2）vs 弱 NPC，应稳赢；HP 差距 ≥ 30

### 10.2 集成测试（browse 自动 E2E）

1. anon login
2. POST 12 次 submit_workout 凑 8+ 张不同卡
3. 进 /deck → Advisor → 采用 → 保存
4. 进 /arena → 选 lv1 NPC → 走 8 回合（脚本帮 attacker + target）
5. 验 result 页：胜负 + XP + season_score 增加 + battles 表写入完整 log

---

## 11. i18n 新增 ~32 key

```
arena.lobby.title:           '对战 — PVE 阶梯' / 'ARENA — PVE LADDER'
arena.lobby.your_segment:    '段位'
arena.lobby.win_loss:        '{w}W {l}L'
arena.lobby.deck_button:     '我的卡组 →'
arena.lobby.empty_deck:      '需先构筑 8 张主卡组'
arena.npc.locked:            '🔒 等级 {n} 解锁'
arena.npc.reward:            '+{xp} XP'

arena.battle.turn_indicator: '回合 {n} / 8'
arena.battle.phase.pick_attacker: '选攻击者'
arena.battle.phase.pick_target:   '选目标'
arena.battle.phase.ai_thinking:   'AI 思考…'
arena.battle.phase.ended:         '结算中…'
arena.battle.exit_confirm:        '退出战斗？进度会丢失。'

arena.result.victory:        '胜利'
arena.result.defeat:         '败北'
arena.result.xp_gained:      '+{xp} XP'
arena.result.again:          '再战'
arena.result.lobby:          '回大厅'

deck.title_n:                '卡组 — {n} / 8'
deck.empty_slot:             '+ 选卡'
deck.advisor:                'ADVISOR 推荐'
deck.advisor_modal.title:    '推荐卡组'
deck.advisor_modal.reasoning:'理由 · {r}'
deck.advisor_modal.accept:   '采用'
deck.save:                   '保存'
deck.save_disabled:          '需 8 张'
deck.saved_toast:            '✓ 已保存'

skill.kind.damage_buff:      '伤害 +{v}'
skill.kind.defense_buff:     '防御 +{v}'
skill.kind.heal:             '回血 +{v}'
skill.kind.shield:           '护盾 +{v}'
skill.kind.pierce:           '穿透'
skill.kind.reflect:          '反弹 {v}%'
skill.kind.first_strike:     '首发 +{v}'
skill.kind.xp_bonus:         'XP +{v}%'
```

---

## 12. 部署 / 迁移注意

- Migration：`20260510000007_arena_extend.sql`
  - alter cards + 40 行 update（ability 映射）
  - create npc_opponents + 8 行 seed
  - alter battles + 加列
  - 2 个 RPC + grant
  - RLS policies for npc_opponents + battles update
- 已发卡 user_cards 不动；老用户 active deck 空 → Lobby 引导构建
- 跑 migration 用 IPv4 pooler URL（WSL2 已知问题）：
  `postgresql://postgres.hahxjtddwnqpklgftsgj:...@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`

---

## 13. 不在 v1 范围

留 Day 6+ 处理：
- `finalize_battle` deep replay 校验（v1 信任 client 报告 HP）
- 战斗中 refresh 后状态恢复（zustand persist）
- PVP 异步对战（防守快照 + 进攻挑战）
- Realtime PVP
- NPC AI 难度梯度（ai_skill 概率扰动）
- 段位升降级特殊规则（连胜加成、连败保护）
- 卡组多套切换（决定 deck 表 is_active 当前是 unique constraint，未来要支持多套）
