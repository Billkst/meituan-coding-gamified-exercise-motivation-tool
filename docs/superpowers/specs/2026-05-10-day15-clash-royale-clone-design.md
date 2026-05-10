# Day 15-20 — 实时塔防对战重制（皇室战争复刻）

**日期：** 2026-05-10
**主题：** 把回合制 ATK/DEF 对战换成皇室战争式实时塔防 + 卡组 meta 经济。复刻原版机制与节奏，本地 vs AI。
**总工时：** 5-6 天（粗估 35-45h）

## 用户反馈直引

> "目前对战游戏的效果不好，能不能做成皇室战争那样的感觉，就是点击对战后进入一个像皇室战争游戏一样的界面进行一局游戏，能实现吗？"
>
> "目前的健身系列卡组说实话很 low，一点产品感都没有，完整重制如果你缺乏灵感，直接照抄皇室战争都可以接受，接受复刻版，但是效果要尽量达到原版的感觉。"

---

## 1. 北极星 (North Star)

> **评审打开 `/arena` → 30 秒能放下第一张牌 → 3 分钟玩完一局 → 战后看到金币奖励 + 卡片升级路径，主动想打第二局。**

不是真正的网络 PvP（PULSE 没匹配系统），是**单机 vs AI** 的局内体验，但要让评审"感觉像皇室战争"。

## 2. 产品决策（与用户对齐过）

| 项 | 决定 |
|---|---|
| 旧的回合制对战 | **覆盖**（`/arena` 路由整个换掉，旧组件归档到 `/legacy`） |
| 战场布局 | **左右 2 路**（皇室战争原版） |
| 双方塔 | 各 **1 王塔 (HP 4000) + 2 公主塔 (HP 2400)** |
| elixir | **0→10 自动充能 1 / 2.8s**，最后 1 分钟变 1 / 1.4s（双倍） |
| 倒计时 | **3 分钟主战 + 1 分钟加时**（决胜：先破塔者赢 / 平局看王塔 HP） |
| 卡组规模 | 牌组 **8 张**，手牌 **4 张**（4-下张预览），首版总池 **12 张** |
| 卡片来源 | **直接照抄皇室战争**经典款 |
| 部队属性模型 | 重写：`cost / hp / dmg / hit_speed / move_speed / range / target_type` |
| 对手 | **本地 AI**（按 elixir 阈值随机出卡，3 档难度） |
| 部署交互 | **拖拽**（移动端长按手牌 → 战场半区高亮 → 抬手部署；桌面 click+move+click） |
| 健身联动 | **打卡 → 金币（100-500，按 XP）→ 解锁/升级卡** |
| 经济 | 胜利 → 银宝箱（30min）；3 连胜 → 金宝箱；金币用于解锁/升级 |
| 旧的 ATK/DEF 卡片 | 保留为图鉴（"PULSE 经典卡"），不进新对战 |
| 测试策略 | 战斗 tick 引擎写**纯函数**单元测试；渲染层手测 |
| 渲染选型 | **DOM + CSS transform**（不用 canvas，单位数 ≤30 性能够） |
| tick 频率 | **30Hz 逻辑层**（requestAnimationFrame 60fps，每帧消化 2 tick） |

---

## 3. 战场设计（核心机制）

### 3.1 战场尺寸（逻辑坐标）

战场用**逻辑网格**而不是像素，便于平衡、回放、AI 决策：

```
┌────────────────────────────────┐  y=32  ← 对手底线
│  [王塔]    [   ]      [王塔]    │  对手塔区
│  [公主塔]            [公主塔]   │  y=27 / y=27
│                                │
│  ────────  河 道  ────────     │  y=16  ← 河道，地面单位走桥
│  [桥]                  [桥]     │
│                                │
│  [公主塔]            [公主塔]   │  y=5 / y=5
│  [王塔]    [   ]      [王塔]    │  你方塔区
└────────────────────────────────┘  y=0
   x=0  ←————— 18 列 ——————→ x=18
```

- 18 列 × 32 行（同皇室战争比例）
- 部署区域：你方半区为 y∈[0, 15]，跨过河道仅当攻破对方公主塔后可以
- 河道：y=15..17 (横向 3 行水)，**地面单位**只能走两侧的桥（x=3 或 x=14）
- **空中单位**忽略河道，自由走直线

### 3.2 塔的位置与碰撞

| 塔 | 你方位置 | 对方位置 | HP | 攻击距离 | 攻击间隔 |
|---|---|---|---|---|---|
| 王塔 (King) | x=8.5, y=2 | x=8.5, y=30 | 4000 | 7 | 1.0s |
| 左公主塔 | x=3, y=5 | x=3, y=27 | 2400 | 7 | 0.8s |
| 右公主塔 | x=14, y=5 | x=14, y=27 | 2400 | 7 | 0.8s |

公主塔被破后，王塔激活（之前王塔被攻击才反击）。

### 3.3 elixir 系统

- 起始 5 elixir，上限 10
- 主战 (0-180s)：1 elixir / 2.8s ≈ 0.357/s
- 加时 (180-240s)：1 elixir / 1.4s（双倍）
- 出牌瞬间扣除 cost（cost 1-9）
- elixir 不足时手牌灰显，禁止拖拽

### 3.4 胜负判定

主战 3 分钟内：
- 谁先破对方**王塔** → 立即胜利
- 谁破对方**公主塔数量更多** → 暂时领先（不立即结束）

3 分钟结束：
- 双方塔数相同 → 进入 1 分钟加时（双倍 elixir）
- 加时仍平 → 看王塔剩余 HP 占比

加时 1 分钟仍平 → 平局（金币 0，宝箱 0）

---

## 4. 12 张首版卡（照抄皇室战争）

8 张部队 + 2 张法术 + 2 张建筑：

### 部队 (Troops)

| ID | 名称 | cost | hp | dmg | hit_speed | move_speed | range | target | 上场数 | rarity |
|---|---|---|---|---|---|---|---|---|---|---|
| `knight` | 骑士 | 3 | 1500 | 150 | 1.2s | 60 (medium) | 1 (melee) | ground | 1 | common |
| `archer` | 弓箭手 | 3 | 250 | 90 | 1.0s | 60 | 5 (ranged) | air+ground | 2 | common |
| `goblin` | 哥布林 | 2 | 200 | 110 | 1.1s | 120 (fast) | 1 | ground | 3 | common |
| `giant` | 巨人 | 5 | 3500 | 200 | 1.5s | 45 (slow) | 1 | building | 1 | rare |
| `musketeer` | 火枪手 | 4 | 700 | 220 | 1.1s | 60 | 6 | air+ground | 1 | rare |
| `mini_pekka` | 小皮卡 | 4 | 1300 | 600 | 1.6s | 90 | 1 | ground | 1 | rare |
| `valkyrie` | 女武神 | 4 | 1700 | 230 | 1.5s | 60 | 1.2 (splash) | ground | 1 | rare |
| `baby_dragon` | 小宝龙 | 4 | 1100 | 100 | 1.6s | 60 | 3.5 | air+ground | 1 | epic |

### 法术 (Spells)

| ID | 名称 | cost | dmg | radius | rarity |
|---|---|---|---|---|---|
| `lightning` | 闪电 | 6 | 600 | 3 (3 个目标) | epic |
| `arrows` | 箭雨 | 3 | 250 | 4 | common |

### 建筑 (Buildings)

| ID | 名称 | cost | hp | dmg | hit_speed | range | target | rarity |
|---|---|---|---|---|---|---|---|---|
| `cannon` | 加农炮 | 3 | 700 | 110 | 1.0s | 6 | ground | common |
| `tesla` | 特斯拉电塔 | 4 | 800 | 130 | 1.1s | 6 | air+ground | rare |

> **数据来源**：皇室战争 Wiki（社区公开数据），数值缩放调整以适配我们的 tick 速率，平衡靠手测调。

---

## 5. 单位行为模型

### 5.1 状态机

```
spawn (1.0s freeze) → walk → engage (in range) → attack (cooldown) → walk
                                ↓
                              death (animation 0.4s, then despawn)
```

- **spawn**：召唤动画 1 秒，无敌不可选不可攻击
- **walk**：朝目标移动；无目标时朝**对方最近王塔/公主塔**走
- **engage/attack**：进入 range 后停下打目标；目标死则切下一个
- **death**：HP ≤ 0，0.4s 缩小淡出，期间不能再被攻击

### 5.2 寻路（简化版，不做 A*）

- 部队按部署位置选**轨道**：x < 9 走左路，x ≥ 9 走右路
- 直线朝**当前路的下一目标**走（己方公主塔被破后才能直冲王塔）
- 每 0.5s 重选目标（target_type 内距离最近的）
- 河道：地面单位 detour 到最近的桥（x=3 or x=14），空中无视

### 5.3 攻击优先级

`target_type` 决定能打谁：
- `ground` → 只打地面（含建筑）
- `air+ground` → 全打
- `building` → 只打建筑（如巨人）

同优先级内：距离最近 > 当前已锁定的优先（防止抖动）

### 5.4 splash 伤害

`range` 字段 < 2 视为单体；女武神 (1.2 splash) 攻击命中点周围 1.2 格内全部敌人受全额伤害。

---

## 6. AI 对手策略

### 6.1 决策循环

每 0.5s 检查一次：
1. 当前 elixir 是否 ≥ 阈值（3 难度档：easy=8, normal=6, hard=4）？
2. 手牌 4 张，按权重选一张：
   - 反制权重：玩家场上有空中单位 → 对空牌（弓箭手/火枪手/小宝龙）+10
   - 防守权重：玩家有部队跨过河道 → 防御建筑/Valkyrie +8
   - 进攻权重：elixir ≥ 8 + 玩家无场上单位 → 巨人/小皮卡 +6
   - 默认：随机
3. 选部署位置：
   - 进攻牌（巨人）→ 后排 (y=29) 中央
   - 防守牌 → 公主塔前 (y=22)
   - 法术 → 玩家最密集的群体

### 6.2 难度差异

| 档位 | elixir 阈值 | 反制概率 | 出牌延迟 |
|---|---|---|---|
| easy | 8 | 30% | +1.0s noise |
| normal | 6 | 60% | +0.5s noise |
| hard | 4 | 90% | +0.0s noise |

首版默认 normal，玩家可在战前选。

---

## 7. 经济与 meta 进度

### 7.1 金币

| 来源 | 量 |
|---|---|
| 运动打卡完成 | 100 + XP × 5（最多 500） |
| 战斗胜利 | 30 |
| 战斗平局 | 10 |
| 战斗失败 | 5 |
| 解锁新卡 | -10 |
| 升级卡（见下表） | 按等级递增 |

### 7.2 升级曲线（11 级）

| 等级 | hp/dmg 增幅 | 升级所需金币 | 升级所需卡碎片 |
|---|---|---|---|
| 1 | 100% (基础) | 0 | 0 |
| 2 | 110% | 5 | 2 |
| 3 | 120% | 20 | 4 |
| 4 | 130% | 50 | 10 |
| 5 | 140% | 150 | 20 |
| 6 | 150% | 400 | 50 |
| 7 | 160% | 1000 | 100 |
| 8 | 170% | 2000 | 200 |
| 9 | 180% | 4000 | 400 |
| 10 | 190% | 8000 | 800 |
| 11 | 200% | 20000 | 1500 |

> 简化：第一版不强求把 11 级全部解锁，玩家试验时 1-3 级足够拉开变化。

### 7.3 宝箱

| 类型 | 解锁时长 | 金币 | 卡碎片 |
|---|---|---|---|
| 银宝箱（胜利） | 30 分钟 | 50 | 20 |
| 金宝箱（3 连胜） | 2 小时 | 200 | 80 |

队列容量：4 个槽位；同时只能解锁 1 个；超出则不再发新箱（已平衡评审体验：开 dev mode 可秒解锁）。

> 评审 5 分钟体验时，**dev_dispatch RPC 加 instant_unlock_chests action**，方便评审看完整流程。

---

## 8. 数据模型 (Postgres)

### 8.1 新表

```sql
-- migration 24: clash royale schema
create table cr_cards (
  id text primary key,                         -- 'knight', 'giant', ...
  name_zh text not null,
  name_en text not null,
  card_type text not null check (card_type in ('troop','spell','building')),
  cost int not null check (cost between 1 and 9),
  rarity text not null,
  base_stats jsonb not null,                   -- { hp, dmg, hit_speed, move_speed, range, target, count }
  unlock_cost int not null default 10,         -- 解锁所需金币
  emoji text not null                          -- 视觉占位
);

create table cr_user_cards (
  user_id uuid not null references users(id),
  card_id text not null references cr_cards(id),
  unlocked boolean not null default false,
  level int not null default 1 check (level between 1 and 11),
  shards int not null default 0,
  primary key (user_id, card_id)
);

create table cr_user_decks (
  user_id uuid primary key references users(id),
  cards text[] not null,                       -- 8 个 card_id
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table cr_account_currency (
  user_id uuid primary key references users(id),
  gold int not null default 100,               -- 起始 100 金币
  shards_total int not null default 0,
  updated_at timestamptz not null default now()
);

create table cr_chests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  chest_type text not null check (chest_type in ('silver','gold')),
  unlocks_at timestamptz not null,
  opened boolean not null default false,
  rewards jsonb,                                -- 解锁后填入
  created_at timestamptz not null default now()
);

create table cr_match_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  result text not null check (result in ('win','loss','draw')),
  duration_seconds int not null,
  player_towers_lost int not null,
  ai_towers_lost int not null,
  ai_difficulty text not null,
  rewards jsonb,
  replay jsonb,                                 -- 简化版 tick log
  created_at timestamptz not null default now()
);
```

### 8.2 新 RPC

| RPC | 输入 | 输出 | 用途 |
|---|---|---|---|
| `cr_unlock_card(card_id)` | text | jsonb | 花金币解锁 |
| `cr_upgrade_card(card_id)` | text | jsonb | 升级 |
| `cr_set_deck(deck_ids[])` | text[] | jsonb | 保存 8 张牌组 |
| `cr_finalize_match(result, duration, towers, replay)` | ... | jsonb | 战后写日志 + 发金币/宝箱 |
| `cr_open_chest(chest_id)` | uuid | jsonb | 开宝箱 |
| `cr_unlock_chest_now(chest_id)` | uuid | jsonb | dev mode 秒解锁 |

### 8.3 移除/改动

- 不动 `cards`, `user_cards`（保留为"PULSE 经典卡"图鉴）
- 不动 `pvp_battles`, `arena_battles`（旧的 RPC，路由切走后 dead code）
- `submit_workout` RPC 加 `gold_earned` 字段（向后兼容）
- `dev_dispatch` 加 actions：`grant_gold`, `unlock_all_cr_cards`, `instant_open_chests`

---

## 9. 文件组织（新增目录 `src/clash/`）

```
src/clash/
├── pages/
│   ├── ClashHome.tsx           主菜单（战斗、牌组、卡片、宝箱、商店）
│   ├── ClashMatch.tsx          战斗页（核心）
│   ├── ClashResult.tsx         战后结算
│   ├── ClashDeck.tsx           牌组编辑
│   ├── ClashCards.tsx          卡片收藏 + 升级
│   └── ClashChests.tsx         宝箱队列
├── engine/
│   ├── tick.ts                 纯函数 tick reducer
│   ├── unit.ts                 单位状态机
│   ├── pathfinding.ts          直线寻路 + 河道 detour
│   ├── ai.ts                   AI 决策
│   ├── targeting.ts            目标选择
│   └── damage.ts               伤害计算（splash 等）
├── components/
│   ├── Battlefield.tsx         战场容器（DOM-based，CSS transform 渲染单位）
│   ├── Unit.tsx                单位 sprite
│   ├── Tower.tsx               塔
│   ├── Hand.tsx                手牌区（4 张）
│   ├── ElixirBar.tsx           elixir 条
│   ├── DragLayer.tsx           拖拽预览层
│   ├── DeployZone.tsx          部署半区高亮
│   ├── DamageNumber.tsx        伤害飘字
│   ├── TimerBar.tsx            倒计时
│   └── DeckCard.tsx            卡片缩略
├── store/
│   ├── useClashMatchStore.ts   战斗状态（实时）
│   └── useClashMetaStore.ts    金币/宝箱/牌组
├── api/
│   ├── clashCards.ts
│   ├── clashDeck.ts
│   ├── clashMatch.ts
│   └── clashChests.ts
├── lib/
│   ├── cardData.ts             12 张卡静态数据 + 等级缩放
│   ├── arena.ts                战场常量（坐标、塔位）
│   └── i18n.ts                 翻译 keys（合并到主 i18n）
└── __tests__/
    ├── tick.test.ts
    ├── pathfinding.test.ts
    ├── ai.test.ts
    └── damage.test.ts
```

旧的 `src/components/battle/*` 整个归档到 `src/legacy/hearthstone-battle/`，路由 `/legacy/arena` 留入口供评审看产品迭代。

---

## 10. UI/UX 设计

### 10.1 ClashHome 主菜单

```
┌────────────────────────────────┐
│   PULSE · CLASH                │
│   "训练即战力"                  │
├────────────────────────────────┤
│                                │
│        ┌───────────┐           │
│        │  对战     │  ← 大按钮 │
│        │  ⚔        │           │
│        └───────────┘           │
│                                │
│  💰 1240    💎 88    🏆 L8     │
│                                │
│  [📖 牌组]  [🃏 卡片]  [📦 宝箱]│
│                                │
│  📦 银宝箱 解锁中 12:34         │
│  📦 银宝箱 等待中               │
│                                │
└────────────────────────────────┘
```

### 10.2 ClashMatch 战斗页

```
┌─[3:00]────────────────────[◙ ◙ 🏰]┐ ← 对手塔状态条
│                                    │
│    🏰        👑王塔        🏰      │
│   公主塔                  公主塔   │
│  ════════════════════════════════ │
│  ▓▓▓▓ 河道 ▓▓▓ 桥 ▓▓ 河道 ▓▓▓▓▓  │
│  ════════════════════════════════ │
│                                    │
│        ⚔(单位移动中)               │
│                                    │
│   公主塔                  公主塔   │
│    🏰        👑你的王塔   🏰      │
├────────────────────────────────────┤
│ [💧💧💧💧💧💧·····] 6/10           │ ← elixir 条
├────────────────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐  next:  │
│  │ 3 │ │ 4 │ │ 5 │ │ 3 │  ┌─┐    │ ← 4 手牌 + 下张预览
│  │骑士│ │火枪│ │巨人│ │箭雨│  │？│    │
│  └───┘ └───┘ └───┘ └───┘  └─┘    │
└────────────────────────────────────┘
```

- 顶部 / 底部塔区用对手红 / 你方绿区分（沿用 BattleArena 经验）
- elixir 条：渐变紫色 + 每秒 +1 动画
- 拖拽手牌：屏幕暗化 + 你方半区高亮 + 落点圆形指示器
- 单位用 emoji + 圆形底色 + HP 条；血量低于 50% 时红光
- 飘字保留（Day 13 已有）

### 10.3 ClashResult 战后

```
┌────────────────────────────────┐
│        VICTORY                 │
│         👑                     │
│                                │
│   你 2 - 0 AI                  │
│   时长 1:42                    │
│                                │
│   奖励：                        │
│   💰 +30                        │
│   📦 银宝箱（解锁中 30:00）      │
│                                │
│   [回放] [继续] [回主页]        │
└────────────────────────────────┘
```

### 10.4 ClashDeck 牌组编辑

- 上方：当前 8 张
- 下方：已解锁 N 张可选
- 点击 swap

### 10.5 ClashCards 卡片收藏

- grid 12 张卡
- 已解锁：显示等级 + 升级按钮 + cost 角标
- 未解锁：灰色 + "解锁 (10 💰)" 按钮

---

## 11. 健身联动 — 完整闭环

```
打卡运动 (Workout 页)
    ↓
完成 → +XP +streak
    ↓
派发 100-500 金币 → cr_account_currency
    ↓
推送通知/横幅："+240 💰 已到账，去 Clash 解锁新卡？"
    ↓
ClashHome 顶部显示金币余额闪光
    ↓
玩家解锁/升级 → 战斗变强 → 胜率提升 → 银/金宝箱
    ↓
宝箱解锁后送卡碎片 → 推动玩家继续打卡赚金币升级
```

**关键：评审打开应用第 1 分钟内，能看完这个闭环图。**

主菜单加一条 **"今日推荐：完成 1 次力量训练 → ~300 💰 → 解锁火枪手"** 的 NextBestAction 卡片。

---

## 12. 与现有 PULSE 系统的边界

### 保留并强化

- `users` 表（不动）
- `submit_workout` (扩展加 `gold_earned`)
- `current_streak / freeze_xp_until / revive_streak`（沿用，金币奖励 streak ≥ 7 时 +20%）
- `friends` 表（保留，将来做好友 PvP）
- `leaderboard` (改为按 Clash 战绩 / trophy 排名)
- `achievements` / `quests` (加 Clash 系列任务："3 连胜"、"用骑士打 10 局"等)
- `dev_dispatch`（加 4 个 Clash actions）
- 设计 tokens (`DESIGN.md`) 全保留 — Clash 沿用 PULSE 视觉语言

### 归档（不删，移到 legacy）

- `src/pages/Arena.tsx, ArenaBattle.tsx, ArenaResult.tsx` → `src/legacy/`
- `src/components/battle/*` → `src/legacy/battle/`
- `src/api/battles.ts, pvpBattle.ts` → `src/legacy/api/`
- 路由 `/legacy/arena` 入口（仅 dev mode 链）

### 移除（评审看不到，但代码留）

- 旧的 `Loot` 抽卡 → 改为 Clash 卡片解锁（金币）
- 但 onboarding 的"3 张抽卡仪式"保留 (Step4) — 改为发**初始 600 金币**而不是抽 ATK/DEF 卡

---

## 13. 实施分期（Day 15-20）

### Day 15 (今天剩余 + 隔夜)：基础设施

- [ ] migration 24（cr_* 表 + seed 12 张）
- [ ] migration 25（cr_* RPCs）
- [ ] `src/clash/lib/cardData.ts`（12 张卡静态数据）
- [ ] `src/clash/lib/arena.ts`（战场常量）
- [ ] `src/clash/store/useClashMetaStore.ts`（meta 状态）
- [ ] `src/clash/api/*`（4 个 RPC hook）
- [ ] 单元测试：单位行为基础

工时：6-8h

### Day 16：tick 引擎

- [ ] `src/clash/engine/tick.ts`（纯函数 reducer）
- [ ] `src/clash/engine/unit.ts`（单位状态机）
- [ ] `src/clash/engine/pathfinding.ts`（直线 + 桥 detour）
- [ ] `src/clash/engine/targeting.ts`
- [ ] `src/clash/engine/damage.ts`（含 splash）
- [ ] `tick.test.ts` (8-10 用例) + `pathfinding.test.ts` (5)

工时：6-8h

### Day 17：战场渲染 + 拖拽

- [ ] `Battlefield.tsx`（CSS transform 单位定位）
- [ ] `Unit.tsx`、`Tower.tsx`
- [ ] `Hand.tsx` + 拖拽（HTML5 drag 或 pointer events）
- [ ] `DragLayer.tsx` + `DeployZone.tsx`
- [ ] `ElixirBar.tsx`、`TimerBar.tsx`
- [ ] 集成 tick 引擎到 ClashMatch 页

工时：8-10h

### Day 18：AI 对手 + 战斗闭环

- [ ] `src/clash/engine/ai.ts`（3 档难度）
- [ ] `ai.test.ts` (5-7 用例)
- [ ] 胜负判定 + 加时 + 战斗结束横幅
- [ ] `ClashResult.tsx`（金币 + 宝箱奖励）
- [ ] `cr_finalize_match` RPC 联通

工时：6-8h

### Day 19：经济 + meta

- [ ] `ClashHome.tsx` 主菜单
- [ ] `ClashCards.tsx`（解锁 + 升级 UI）
- [ ] `ClashDeck.tsx`（牌组编辑）
- [ ] `ClashChests.tsx`（宝箱队列）
- [ ] `submit_workout` 扩展 + 金币结算横幅
- [ ] `dev_dispatch` 4 个 Clash actions

工时：6-8h

### Day 20：i18n + 集成测试 + 部署

- [ ] 全部 Clash 翻译 keys（zh + en）
- [ ] NextBestAction 卡片改为 "运动 → 金币 → 解锁" 提示
- [ ] 旧 Arena 归档到 `/legacy`
- [ ] dev mode chest 秒解锁
- [ ] E2E 手测：onboarding → home → 打卡 → 解锁 → 战斗 → 战后
- [ ] tsc + tests + build 全 green
- [ ] Vercel 部署 + 再打开评审 URL 验证

工时：4-6h

---

## 14. 不做的事（明确划界）

- ❌ **真人 PvP / 网络匹配**（PULSE 没匹配系统，AI 是单机）
- ❌ **公会 / 部落 / 锦标赛**
- ❌ **3D 单位模型 / 真实皇室战争插画**（emoji + 圆底色）
- ❌ **超过 12 张卡**（首版牌池足够展示机制）
- ❌ **复杂 A\* 寻路**（直线 + 桥 detour 够用）
- ❌ **canvas / WebGL**（DOM 性能足够 30 单位以下）
- ❌ **粒子系统 / Lottie**（CSS keyframe + emoji 即可）
- ❌ **音效 / BGM**（评审不会打开声音）
- ❌ **iOS / Android native 版**（Web 单平台）
- ❌ **保留旧炉石回合制对战在主路由**（归档到 legacy）

---

## 15. 风险与备案

| 风险 | 触发条件 | 备案 |
|---|---|---|
| tick 引擎性能不足 | DOM 单位 >30 时掉帧 | 降到 15Hz 逻辑层；动画用 CSS only |
| 拖拽在 mobile 体验差 | 长按延迟，落点不准 | 改用 click+click 两段式（先选卡，再点战场） |
| 平衡难调 | 巨人无脑赢 | 测试期反复手测；评审前固定一套"标准对局" |
| AI 太菜 | 评审随便就赢 | 默认 normal，结算页提示"可在战前选 hard" |
| migrations 24/25 push 失败 | WSL2 IPv4 问题 | 沿用 CLAUDE.md 的 pooler URL 套路 |
| 时间不够 | Day 20 仍未跑通完整闭环 | 砍 Day 19 经济细节，宝箱/升级简化为"立即结算" |

---

## 16. 验收

### 评审 5 分钟体验路径

1. 打开 URL → onboarding 完成 → ClashHome
2. 看到 600 金币起始 + 3 张已解锁卡 + "对战" 大按钮
3. 点击对战 → 选 normal 难度 → 进战斗
4. 30 秒内放下第一张牌 → 看见单位走路、过河、攻塔
5. 3 分钟内分出胜负 → 战后看到金币 +30 + 银宝箱
6. 回主页 → 30 分钟解锁可用 dev `instant_open_chests` 秒开
7. 拿卡碎片去升级一张卡
8. 再打一局 → 体验"我变强了"的反馈
9. 打开 Workout 页面 → 提交一次健身 → 回 Clash 看金币 +240 横幅

### 技术验收

- [ ] `bunx tsc --noEmit` 通过
- [ ] `bun run test` 全部 pass（旧的 63 + 新增 25-30 个 tick/AI/damage 单测）
- [ ] `bun run build` 成功
- [ ] Vercel 部署成功，URL 稳定
- [ ] DESIGN.md 视觉规范全程遵守（accent-primary 绿、display 字体、subtle glow）
- [ ] 移动端（iPhone 12 mini 视口）拖拽顺手
- [ ] 桌面（1080p）布局合理

### 产品验收

- [ ] 评审能在 30 秒内看懂"打卡 → 金币 → 解锁/升级 → 变强"循环
- [ ] 战斗自带新手提示（首次进入 ClashMatch → 3 步 spotlight）
- [ ] 战后结算明确告知"为什么赢/输 + 下一步做什么"

---

## 17. Open Questions（写进 spec 让用户拍板）

1. **牌组锁定**：评审是否一定要换牌组？还是默认给个 8 张固定牌组就够？（建议：默认锁，玩 3 局后允许换）
2. **宝箱秒解锁**：dev mode 的 `instant_open_chests` 是否对评审默认开启？还是评审要点 dev chip？（建议：评审默认 5 分钟内秒解锁，提示"评审快进模式"）
3. **音效**：要不要给"放牌"、"塔被破"加 1-2 个简单音效？（建议：不做，评审不开声）
4. **回放**：战后是否需要"回看"功能？(建议：不做，记录到 `replay` 字段供未来用)
5. **NPC vs AI**：旧的 NPC 战斗（孔武有力等）保留吗？(建议：归档，评审看到"PULSE 经典模式"链接可点)

---

## 附录 A：技术栈选型理由

### 为什么 DOM + CSS transform 而不是 canvas？

- 单位数 ≤ 30，DOM 性能完全够（每帧 30 个 transform 远低于阈值）
- canvas 需要重新设计 hit-testing、event handling、动画，从 0 开始
- DOM 让 React 状态管理直接落到 UI，无渲染层抽象
- 已有 Tailwind / DESIGN.md 视觉系统直接可用

### 为什么纯函数 tick reducer？

- 可测试（无副作用，确定性）
- 可回放（保存 reducer input 即可重现）
- 状态层与渲染层解耦

### 为什么 30Hz 逻辑而不是 60Hz？

- 30Hz 即 33.3ms / tick，对玩家肉眼"丝滑"已足够
- 30Hz 给 CPU 更多空间做 AI / pathfinding
- 渲染仍 60fps（每 2 帧消化 1 tick + 插值）

---

**下一步：** 用户审过此 spec → 进入 Day 15 plan 编写 → 开干。
