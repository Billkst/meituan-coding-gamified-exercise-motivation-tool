# Day 13-14 — 战场炉石化 + 战术深化 + 视觉精致 + 首次教学

**日期：** 2026-05-10
**主题：** 解决用户实测后的两个核心抱怨——"分不清敌我"和"观感太差"。一口气覆盖 Day 13 + Day 14。

## 用户反馈直引

> "目前的对战我看到有 16 张卡，一回合我要点击两张卡，这两张卡都是我的吗？那对手打什么卡呢？还有这个战斗的界面看起来也很不好，观感很差，至少模仿一下炉石传说的界面设计吧。"

两个独立问题，都很致命：

1. **敌我混淆**——上方 8 张其实是对手的卡，下方 8 张是玩家的，但当前布局用同样底色 + 同样卡片样式，玩家以为 16 张都是自己的。AI 反击只用 800ms `animating_ai` phase 一闪而过，玩家没意识到对手有出招。
2. **视觉简陋**——纯 grid + 文字 + 边框 halo，没有"对峙"、"舞台"、"卡牌艺术"的感觉。炉石的 minion zone / hero portrait / 法力水晶等元素一样不沾。

## 设计目标（炉石化 + 不偏离 PULSE 的赛博风）

不照搬炉石美术（那是写实奇幻），但学三件事：

1. **战场分区，色彩对峙** —— 敌方区微红色调 + 我方区微绿色调（accent-primary），中央一条战线分隔
2. **卡牌精致化** —— 加 emoji 艺术区 + ATK/DEF 圆形角标（炉石的水晶感）+ 选中卡浮起 + 金色光环
3. **行动反馈强化** —— 选 attacker 后高亮 + 浮起；攻击瞬间冲撞动画 + 红色伤害飘字 + HP tick down；AI 反击同等强度 vfx，让玩家**看见**对手在打谁

## Day 13 范围（4 子任务，6-8h）

### 1. BattleArena 战场重构

新组件 `<BattleArena>` 替换现有 `<BattleBoard>` 内部。布局：

```
[对手头像 + 名字 + Lv]                          HP 100/100
═══════════════════════════════════════════════ HP bar (red tint)
┃ [card] [card] [card] [card]                  ┃  enemy zone
┃ [card] [card] [card] [card]                  ┃  (red tinted bg)
━━━━━━━━━━━━ TURN 3 / 8 · 选你方一张卡 ━━━━━━━━  battle line + phase
┃ [card] [card] [card] [card]                  ┃  player zone
┃ [card] [card] [card] [card]                  ┃  (green tinted bg)
═══════════════════════════════════════════════ HP bar (green tint)
[你的头像 + 名字 + Lv]                          HP 100/100
```

- 双方头像（用 first letter of username + bg 圆圈代替头像图）
- HP 大字号（8xl）+ HP bar
- 战场分隔线 + phase 提示居中（大字号 + 颜色随阶段变化）
- 玩家区背景：`rgba(182, 255, 60, 0.04)` + accent-primary 边框
- 对手区背景：`rgba(255, 70, 70, 0.04)` + semantic-error 边框
- 区域标签：左上角 mono 文字 `OPPONENT` / `YOU` (uppercase)

### 2. CardSlot 炉石卡牌化

重做 `<CardSlot>`：

- **顶部艺术区**（h-12）：emoji 大字（按卡片 sport_type / synergy 派生），rarity 色微光晕
- **中部**：卡名（display font, bold, center, 12px）+ 能力 icon（小字 inline + 颜色 tint）
- **底部 ATK/DEF 角标**：左下 ATK 圆形 chip（红橙色背景 + 白字数字），右下 DEF 圆形 chip（蓝色背景 + 白字数字）—— 炉石的"水晶 + 宝石"感
- **死亡卡**：整张灰蒙 + 大 X 角标
- **已出过的卡**：opacity-50 + "已出"半透明蒙层
- **选中**：浮起 -8px + 金色 ring-2 + glow-legendary
- **推荐**：legendary 色 ring（pulse 动画）
- **damagePreview 标签**：原有保留

### 3. 攻击 + 飘字动画

- 选 attacker：CSS transition 让卡片 `translate-y-[-8px]` + ring + glow（已有，强化）
- 选 target → 进入 `animating_player`：
  - attacker 卡 keyframe 短暂"冲向 target"（translateY(-30px) translateX 朝目标方向 200ms 来回）
  - target 上方浮出红色大字 `-23` （opacity-0 → opacity-100 → opacity-0 + translateY(-40px) 800ms）
  - HP 数字 tick down（用 useEffect interval 模拟数字递减 300ms）
- AI 反击 `animating_ai`：同样的动画，但相反方向，飘字在玩家卡片上方 — 让玩家看见对手在打谁
- 战斗结束 `finalizing`：胜负横幅 fade in

### 4. 大字 phase 提示 + 战场背景装饰

- 战斗中央分隔线含 phase 文字（变色）：
  - `pick_attacker` → 绿色 "你的回合 · 选自己的卡"
  - `pick_target` → 黄色 "选对手的卡作为目标"
  - `animating_player` → 灰色 "出招中..."
  - `ai_thinking` → 紫色 "对手思考中..."
  - `animating_ai` → 红色 "对手反击！"
  - `finalizing` → 金色 "结算..."
- 战场背景：径向渐变（中心 darker，边缘 darkest）+ subtle grid pattern

## Day 14 范围（4 子任务，5-7h）

### 5. 战后 result 解读重做

`<ArenaResult>` 改造：

- 顶部"VICTORY/DEFEAT"保留
- 中部新增 `<BattleHighlights>`：
  - **关键时刻**：找 log 中 `actual_damage` 最高的 entry → "第 N 回合，[某卡] 用 [某能力] 造成 X 伤害（关键转折）"
  - **能力触发统计**：列出所有 trigger 类型 + 触发次数
  - **HP 曲线**：mini chart（用 SVG 自绘，showing attacker/defender HP over 8 turns）
- 替换原有 `replay_title` 列表（保留可折叠）

### 6. 首次 PVE tutorial overlay

- 进入第一场战斗（localStorage 没有 `pulse.battle.tutorial_seen`）→ 自动弹 3 步教学：
  - Step 1: 高亮顶部敌方区，文字"对手的 8 张卡 — 你要把它们打倒"
  - Step 2: 高亮底部我方区，文字"你的 8 张卡 — 选一张攻击"
  - Step 3: 文字"先点你方一张 → 再点敌方一张 → 出击！"
- "我懂了" 按钮 + 跳过 link
- 跳过 / 完成 → setItem(`pulse.battle.tutorial_seen`, '1')

### 7. 战术推荐 RPC（deck builder）

- migration 23: `recommend_deck_for_npc(p_npc_id text)` returns jsonb
  - 拿用户全部 user_cards
  - 用 advisor.ts 的 score 公式 + 对该 NPC deck 的 ATK/DEF 加权
  - return `{deck: text[8], reasoning_zh, reasoning_en}`
- DeckBuilder 加 dropdown "对哪个 NPC 优化？" + "应用推荐" 按钮
- 选完 NPC 后显示推荐 deck 的 8 张卡 high-light → click 应用直接覆盖当前 deck

### 8. 卡牌 emoji 艺术（自动分配）

每张卡按 sport-type / synergy 关键词分配 emoji（写在 `src/lib/cardArt.ts` 的纯映射函数，不改数据库）：

- `running` 系 → 🏃
- `cycling` → 🚴
- `swimming` → 🏊
- `strength` → 💪
- `yoga` → 🧘
- `ball` (basketball/soccer) → ⚽ / 🏀
- legendary 通用 → ⚡
- 默认 → ✨

这是占位艺术；测评作业不可能给 120 张卡画插画。emoji 配 rarity 色微光足够拉开视觉档次。

## 不做的事（明确划界）

- **不重写战斗机制**——回合制 + 8 卡 + ability triggers 保留
- **不引入动画库**（framer-motion / GSAP）——用 CSS keyframes + 短小 React 动画
- **不画真实卡牌插画**——emoji + rarity 边框 + 光晕
- **不重做 finalize_battle RPC**——战后 result 用现有 log 数据自渲染
- **不改 PVP 流程**（沿用同套战场）

## 工时

| 子任务 | 工时 |
|---|---|
| 1. BattleArena 战场重构 | 2.5h |
| 2. CardSlot 炉石化 | 1.5h |
| 3. 攻击 + 飘字动画 | 1.5h |
| 4. phase 提示 + 背景 | 1h |
| 5. 战后 result 重做 | 1.5h |
| 6. 首次 PVE tutorial | 1h |
| 7. 战术推荐 RPC + UI | 2h |
| 8. emoji 艺术 | 0.5h |
| **总计** | **11.5h** |

实际可压缩到 5-7h（既有 design tokens 复用 + ability icons 复用）。

## 验收

- 进战斗：敌我两区色彩分明，玩家一眼看出 16 张卡的归属；中央 phase 横幅大字提示当前要做什么
- 卡牌：emoji 艺术 + 圆形 ATK/DEF 角标 + 死亡/已出/选中状态可视化
- 选 attacker → 卡浮起 + 高亮；选 target → attacker 冲撞动画 + 红字 -N 飘字 + HP tick down；AI 反击同样有 vfx，玩家**看见对手在打谁**
- 战后 result：关键时刻 + 能力触发统计 + HP 曲线
- 首次进战斗：3 步 tutorial 弹出（一次性）
- DeckBuilder：可选 NPC 拿推荐 deck，一键应用
- 卡牌艺术 emoji 在 library / battle / loot 各场景均显示
- `bunx tsc --noEmit && bun run test && bun run build` 全 green
