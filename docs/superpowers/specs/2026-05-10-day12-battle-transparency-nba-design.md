# Day 12 — 战斗透明化 + 新人 Next-Best-Action 设计

**日期：** 2026-05-10
**主题：** 让 Arena 战斗"看得懂、知道怎么打"，让 Dashboard "知道下一步去哪"

## 背景：用户实测反馈

用户实测后指出 5 个 gap（按破窗严重度）：

1. **新人首屏空白** — onboarding + tour 完了站在 dashboard 不知道做啥
2. **战斗规则不透明** — Arena 一回合属性对撞，看到动画但不懂为何赢/输
3. **卡片信息不全** — 只有 name + ability_text + atk/def，模糊文字看不懂
4. **战术决策无辅助** — 没人告诉用户该用哪 8 张组队、对战时该出哪张
5. **卡片视觉简陋** — 缺 illustration、rarity 区分弱（Day 14 处理）

Day 12 解决 1-4，Day 13 加深 3-4，Day 14 处理 5。

## 核心洞察：战斗机制本身没问题，UI 没把决策依据呈现给玩家

战斗实际是 **8 回合 1v1 卡牌对战**：

- 双方各 8 张卡，玩家选 attacker → 选 target → AI 反击
- 每张卡有 ATK / DEF / star_level（+20% per star）
- ability triggers：on_attack（damage_buff / first_strike / pierce）/ on_defend（reflect）/ on_play（shield）/ passive（damage_buff）/ on_battle_end（heal / xp_bonus）
- 损伤公式：`(base_atk × star) + on_attack_buffs × passive_multiplier - effective_def`
- pierce 跳过 def，shield 给全队 +DEF buff，reflect 反伤

这套规则**很有策略空间**，但当前 BattleBoard 只显示：name + ATK/DEF + star。玩家完全不知道：

- 哪张卡有什么 ability
- 当前 active buffs 是什么
- 用 X 打 Y 会造成多少伤害
- 哪张敌方卡 def 最低 / 哪张能 reflect

**结论**：不重做战斗机制，而是把现有数据和计算结果**显性化**。让玩家信息完整后自己决策。

## Day 12 范围（6 子任务）

### 1. CardSlot 升级：ability badge + active buffs

每张卡显示：
- 现有：name、ATK / DEF、star
- 新增：ability icon（按 ability_kind 用 tabler icons：sword=damage_buff, bolt=first_strike, target=pierce, shield=shield, reverse=reflect, heart=heal, gift=xp_bonus）
- 新增：active_buffs 数量 badge（"+3 DEF 来自护盾"）
- 新增：long-press / click & hold（mobile）显示完整 ability tooltip

**呈现策略**：每张卡多加 1 行（ability icon + 简短描述），buff 显示在角标。tooltip 用 `<details>` 或 hover-only 卡详情。

### 2. 战时 damage preview

进入 `pick_target` 阶段后，hover/tap 每张敌方卡显示预计伤害：
- 调用现有 `resolveAttack` 模拟一次（不修改 state）
- 显示 `actual_damage` 数字 + `triggers_fired` 简短说明
- 选中状态高亮"最高伤害"的 target

**实现**：`<CardSlot>` 加 `damagePreview?: number | null` prop，悬停时计算并显示。或者全部预计算后在 BattleBoard 一次性显示。

后者更优——选 attacker 后**所有敌方卡同时显示数字**，玩家一眼比较选最优。

### 3. 战术建议 hint（next-move advisor）

BattleBoard 顶部显示一条建议：
- `pick_attacker` 阶段：列出"+你的 attacker 候选"，按 score（atk × star + 是否能 pierce / first_strike）排序，建议第一个
- `pick_target` 阶段：列出最优 target（已选 attacker 对每个未死亡 target 的预计伤害最大值），建议第一个
- 文案："💡 推荐：用 [中文卡名] 打 [中文卡名] → 预计 23 伤害"

**实现**：`src/lib/battle/advisor.ts` 加 `recommendNextMove(state)` 函数。可关闭（如果用户已经懂了）—— 加个 sessionStorage 标志 `pulse.battle.hide_hint`。

### 4. 战斗规则 + 能力 cheatsheet modal

`<BattleRulesModal>`：
- 触发：BattleBoard 右上角 `<IconInfoCircle>` 按钮
- 内容（一页）：
  - 战斗目标：8 回合或先把对手 HP 打到 0
  - 损伤公式：`(ATK × 星级加成 + 能力加成) - 防御 = 伤害`
  - 能力一览（按 ability_kind 列）：sword/bolt/target/shield/reverse/heart/gift 各 1 行
- 也在 `/arena` 选关页右上加同一个图标

### 5. Dashboard NBA 状态机卡片

新组件 `<NextBestActionCard>` 取代当前 dashboard streak hero 上方位置：

| 用户状态 | NBA 文案 | CTA |
|---|---|---|
| `workouts == 0` | "迈出第一步" + "提交一次运动 → 抽 1 张卡 + XP" | 去打卡 → /workout |
| `workouts > 0 && cards < 8` | "继续抽卡解锁卡组" + "再打 N 次解锁 8 张" | 再打一次 → /workout |
| `cards >= 8 && active_deck_size < 8` | "组建你的主卡组" + "选 8 张组队进 Arena" | 去组队 → /deck |
| `deck_ready && pve_battles == 0` | "首战 Arena" + "你的卡组已就绪，去对战" | 去对战 → /arena |
| `pve_battles > 0 && friends_active == 0` | "找朋友 PVP" + "排行榜上 + 加好友 → 发起对战" | 去排行榜 → /leaderboard |
| `friends_active > 0 && quests_unclaimed > 0` | "今日还有任务" + "完成今日 3 任务拿 bonus" | 滚动到任务卡 → 同页锚点 |
| else | 无 NBA 卡片，回到现有 dashboard 布局（用户已通关核心循环） | — |

**数据**：复用 `useCurrentUser` + 新 hook `useNbaState()` 聚合 (workouts_count, owned_cards_count, active_deck_size, pve_battle_count, active_friends_count)。建议 1 个 RPC `get_nba_state()` 一次返回这些数。

### 6. Arena 选关页 deck preview

每个 NPC 卡片**展开**后显示 NPC 的 8 张 deck（hover 或 tap → expand）：
- 双方 deck 的 ATK / DEF 总和对比
- 简单胜率指示："你方占优 / 旗鼓相当 / 劣势"（基于纯属性总和差值，仅作参考；不揭示 ability 加成以保留惊喜）

**实现**：NPC table 应该已经有 `deck_card_ids` 字段。如果没有，需要从 cards 表抽样组装（migrations 应该已经做了 NPC seed）。

## 不做的事

- 不改战斗机制本身（仍是回合制 1v1）
- 不加 PVP-specific advisor（PVP 用同套）
- 不加 deck builder 推荐"对此 NPC 最优卡组"（Day 13 处理）
- 不加卡片 illustration / 视觉精致度（Day 14）
- 不加战后回放可视化（Day 13 候选）

## 设计决策

### 1. 选 hint 而非 auto-play
- 用户要"知道打哪张"，不要"系统替我打"
- hint 文案保留学习意图："💡 推荐..."不是"系统自动..."
- 可关闭（不打扰熟练玩家）

### 2. damage preview 全显示，不只 hover
- mobile 没 hover，必须可见
- 一眼比较所有目标的预计伤害是核心决策动作
- 视觉成本：每张卡角标显示数字，不挤占主体

### 3. NBA 状态机用 "?? else"，不用复杂权重
- 测评作业不需要 ML 推荐
- 状态机覆盖典型路径：onboarded → first_workout → first_deck → first_pve → first_friend → done
- 一旦走完闭环回到无 NBA 状态，让用户自己探索

### 4. 战斗规则 modal 是"主动学习"入口，不强弹
- 第一次进 Arena 不强弹（避免 onboarding 疲劳）
- "i" 图标随时可点
- Tour step 已经讲了一次概念，这里是 deep dive

### 5. NPC deck preview 不全揭露
- 显示 atk/def 总和、卡片名字
- 不显示 ability triggers（保留首战的"哦原来这张卡这么强"惊喜感）

## 工时估算

| 子任务 | 工时 |
|---|---|
| 1. CardSlot 升级 | 1.5h |
| 2. 战时 damage preview | 1.5h |
| 3. 战术建议 hint + advisor.ts | 1.5h |
| 4. 战斗规则 modal | 1h |
| 5. Dashboard NBA + RPC | 1.5h |
| 6. Arena 选关页 deck preview | 1h |
| i18n + tests + commit/push 节奏 | 0.5h |
| **总计** | **8.5h** |

实际 6-9h 视交付质量。每子任务独立 commit + push，URL 持续可用。

## 验收

- 进 Arena → 战斗页：每张卡显示 ability icon、active buffs；选 attacker 后所有 target 显示预计伤害；顶部建议条出现
- 点 "i" → 弹规则 modal，含 7 种能力说明
- 进 Dashboard（fresh user / mid-progress user / done user）：NBA 卡片正确切换；CTA 跳转正确
- /arena 选关：每个 NPC 可展开看 deck + 胜率提示
- 现有功能回归：PVE 战斗 + result + season_score + PVP 全流程不变
- `bunx tsc --noEmit && bun run test && bun run build` 全 green
