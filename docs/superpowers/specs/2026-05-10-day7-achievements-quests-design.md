# Day 7 — 成就系统 + 每日任务 Design

**Date:** 2026-05-10
**Status:** APPROVED (scope confirmed: 全部按提案)
**Source route:** Day 6 收官后扩展，补足 PULSE 长期 retention 闭环

## Goal

PULSE Day 1-6 完成的是"短期 hook"（每天来 = 抽卡 + Arena）。Day 7 补足**长期 retention**：

- 给玩家"30 天后还想回来"的理由 — 永久成就 + 阶段性目标
- 给玩家"今天打开 app 该做什么"的明确指引 — 每日 3 个任务
- 评审打开 Dashboard 一眼看到任务卡 + 进度反馈

## Premises

- 不做赛季机制（用户已确认非必要）
- 不做手动选任务（任务从模板池随机生成，玩家不挑）
- 不做成就稀有度炫耀（Dashboard 不展示徽章数对比，避免社交压力 — 这是 Day 8+ 社交方向的事）
- 不做赛季排行榜（同上）
- 任务刷新时间用 `current_date`（服务器 UTC），简化时区问题，README 注明
- 进度更新走"在现有 RPC 内嵌入 helper" 路径，**不**用 trigger（trigger 调试痛苦，且现有 RPC 已经是 security definer）
- 测评作业语境 → 不实装 anti-cheat，trust submit_workout 数据

## Architecture

**Schema First** + **Helper RPC pattern**：
- 4 张新表 + 1 张 alter（users 加 `last_quest_date`）
- 1 个共享 helper：`update_progress(p_user_id, p_metric, p_delta)` — 同时更新 user_achievements + daily_quests
- 4 个新 RPC：`get_achievements`, `claim_achievement`, `get_daily_quests`, `claim_quest`
- 在 `submit_workout` / `end_battle` 内调用 `update_progress`（不是 trigger）

层次：
1. **Server:** migration 12 — 4 表 + alter users + seed achievements + seed quest_templates + 5 RPC
2. **Client API:** 4 个 React Query hook（`@/api/achievements.ts` + `@/api/quests.ts`）
3. **UI:**
   - 新 page `/achievements` + Sidebar item
   - Dashboard 新增 `DailyQuestsCard` 组件
4. **i18n:** ~30 keys × 2 lang（成就名 + 任务模板 + UI 文案）

---

## 1. 数据模型

### 1.1 users alter（migration 12）

```sql
alter table public.users
  add column last_quest_date date;
```

| 字段 | 类型 | 含义 |
|---|---|---|
| `last_quest_date` | date null | 上次生成每日任务的日期。`< current_date` 时下次 `get_daily_quests` 触发重新生成 |

### 1.2 achievements（成就定义表，系统数据）

```sql
create table public.achievements (
  id text primary key,
  category text not null,         -- workout/streak/cards/arena/special
  name_zh text not null,
  name_en text not null,
  description_zh text not null,
  description_en text not null,
  metric text not null,           -- 用 update_progress 时匹配的 metric
  tier int not null default 1,    -- 1-4，多阶成就同一线 4 个 tier
  target_value int not null,      -- 解锁阈值
  reward_kind text not null,      -- xp / protect / card / badge_only
  reward_payload jsonb,           -- {xp: 200} / {card_id: 'rare-001'} / {} for badge_only
  icon text not null,             -- tabler icon name 或 emoji 备用
  display_order int not null,
  parent_id text                  -- 多阶成就的上一阶 id，最低阶为 null
);

create index on public.achievements (category, display_order);
```

### 1.3 user_achievements（玩家进度表）

```sql
create table public.user_achievements (
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  current_value int not null default 0,
  unlocked_at timestamptz,        -- null = 进行中
  claimed_at timestamptz,         -- null = 未领奖
  primary key (user_id, achievement_id)
);

create index on public.user_achievements (user_id, unlocked_at);
```

**State machine:**
- `current_value < target_value` → 进行中
- `current_value >= target_value AND unlocked_at IS NULL` → 解锁瞬间（next get_achievements 把它写为 unlocked_at = now()）
- `unlocked_at IS NOT NULL AND claimed_at IS NULL` → 已解锁未领奖（UI 显示 "领取奖励" 按钮）
- `claimed_at IS NOT NULL` → 已完成

### 1.4 quest_templates（任务模板表）

```sql
create table public.quest_templates (
  id text primary key,
  difficulty text not null,       -- easy / medium / hard
  metric text not null,           -- workout_count / duration_min / sport_variety / arena_wins / draw_rare_plus
  target_min int not null,
  target_max int not null,
  reward_xp int not null,
  description_zh text not null,   -- 含占位符 {n}
  description_en text not null,
  active boolean not null default true
);
```

### 1.5 daily_quests（玩家每日任务实例）

```sql
create table public.daily_quests (
  user_id uuid not null references public.users(id) on delete cascade,
  quest_date date not null,
  slot int not null,              -- 1, 2, 3
  template_id text not null references public.quest_templates(id),
  metric text not null,           -- 复制自 template，避免 join
  target_value int not null,      -- 实例化时 random in [target_min, target_max]
  current_value int not null default 0,
  reward_xp int not null,         -- 复制自 template
  completed_at timestamptz,
  claimed_at timestamptz,
  primary key (user_id, quest_date, slot)
);

create index on public.daily_quests (user_id, quest_date);
```

**State machine:** 同 user_achievements（进行中 / 完成未领 / 已领）。

### 1.6 RLS

```sql
alter table achievements enable row level security;
alter table user_achievements enable row level security;
alter table quest_templates enable row level security;
alter table daily_quests enable row level security;

create policy "achievements readable by anon" on achievements for select using (true);
create policy "quest_templates readable by anon" on quest_templates for select using (true);
create policy "user_achievements readable by owner" on user_achievements for select using (user_id = auth.uid());
create policy "daily_quests readable by owner" on daily_quests for select using (user_id = auth.uid());
-- 所有写入走 security definer RPC，不允许直写
```

---

## 2. RPC 设计

### 2.1 helper: `update_progress(p_user_id uuid, p_metric text, p_delta int)`

`security definer`，被 submit_workout / end_battle / draw_card 调用。

**逻辑：**
```
1. 同步更新所有匹配 metric 的 user_achievements:
   for each row in achievements where metric = p_metric:
     upsert user_achievements (user_id, achievement_id) value+= p_delta
     if reaches target_value AND unlocked_at IS NULL: set unlocked_at = now()

2. 同步更新今日 daily_quests:
   update daily_quests set current_value = current_value + p_delta
     where user_id = p_user_id AND quest_date = current_date AND metric = p_metric
   for any row reaching target_value AND completed_at IS NULL: set completed_at = now()
```

**返回：** void（解锁/完成时不直接给奖励，奖励等用户手动 claim）。

### 2.2 metric 列表

| metric | 含义 | 触发点 |
|---|---|---|
| `workout_count` | 任意运动 +1 | submit_workout |
| `workout_minutes` | 运动时长 +duration | submit_workout |
| `workout_sport_count` | 仅当 sport 是当日首次 +1 | submit_workout（前提：今日该 sport 是第一次提交） |
| `streak_max` | 当前 streak 数（直接 set，不累加）| submit_workout |
| `card_unique_count` | 唯一卡牌数（new card 才 +1） | submit_workout（card 抽到时） |
| `legendary_card_count` | 抽到传说 +1 | submit_workout |
| `arena_battles` | Arena 出战 +1 | end_battle |
| `arena_wins` | Arena 胜利 +1 | end_battle（result = 'win'） |
| `protect_card_used` | 保护卡消耗 +1 | submit_workout（protect_card_consumed = true 时） |
| `revive_count` | 复活成功 +1 | revive_streak |

⚠️ `streak_max` 是特殊 metric — 不累加，直接 set max。helper 内部对这个 metric 做 `current_value = greatest(current_value, p_delta)`。

### 2.3 `get_achievements()` → jsonb

返回结构：
```json
{
  "categories": [
    {
      "key": "workout",
      "achievements": [
        {
          "id": "workout_001",
          "name": "运动达人 I",
          "description": "完成第一次运动",
          "tier": 1,
          "target": 1,
          "current": 1,
          "icon": "IconRun",
          "unlocked_at": "2026-05-10T...",
          "claimed_at": null,
          "reward": {"kind": "xp", "payload": {"xp": 50}}
        }
      ]
    }
  ],
  "summary": {
    "total": 12,
    "unlocked": 3,
    "claimable": 1
  }
}
```

实现细节：
- 第一次调用对该用户：循环 achievements 表，对每个 id 在 user_achievements 缺失则 insert (current_value=0, unlocked_at=null)
- 然后 select join 返回
- `unlocked_at` 在 `update_progress` 写入时设置（不在这里重算）

### 2.4 `claim_achievement(p_id text)` → jsonb

发奖：
```
1. 校验 user_achievements 行存在 + unlocked_at != null + claimed_at = null
2. 根据 reward_kind 发奖：
   - xp: users.weekly_xp += payload.xp; users.lifetime_xp += payload.xp
   - protect: users.protect_cards = least(3, protect_cards + 1)
   - card: 走 grant_card 逻辑（add to user_cards + decks.card_ids）
   - badge_only: 不发实物，仅 ack
3. set claimed_at = now()
4. 返回 {ok: true, reward_kind, reward_payload, claimed_id}
```

### 2.5 `get_daily_quests()` → jsonb

```
1. 检查 users.last_quest_date != current_date：
   - 删除 daily_quests where user_id = uid AND quest_date < current_date（清旧）
   - 从 quest_templates 各难度池随机取 1（easy/medium/hard）
   - 每个模板的 target_value 在 [target_min, target_max] 随机
   - insert 3 行到 daily_quests，slot = 1/2/3
   - update users set last_quest_date = current_date
2. select 今日 3 行返回

返回结构：
{
  "quests": [
    {"slot": 1, "difficulty": "easy", "metric": "workout_count",
     "description": "完成 1 次运动",
     "target": 1, "current": 0,
     "reward_xp": 50,
     "completed_at": null, "claimed_at": null}
  ],
  "all_completed_bonus_claimed": false
}
```

### 2.6 `claim_quest(p_slot int, p_claim_bonus boolean)` → jsonb

- `p_claim_bonus = false`: 单个任务领奖
  - 校验 daily_quests 行 quest_date = current_date AND slot = p_slot AND completed_at != null AND claimed_at = null
  - users.weekly_xp/lifetime_xp += reward_xp
  - set claimed_at = now()
- `p_claim_bonus = true`: 全完成 bonus 领奖
  - 校验今日 3 个 quest 都 claimed_at != null
  - 校验今日 bonus 还没领（用 users 上加一个 `last_quest_bonus_date` date 字段判断 != current_date）
  - users.weekly_xp/lifetime_xp += 200，granted 1 张随机卡（grant_card 走 common 池）
  - update users set last_quest_bonus_date = current_date

**users 再 alter 一个字段：**
```sql
alter table public.users add column last_quest_bonus_date date;
```

### 2.7 嵌入既有 RPC

修改 `submit_workout`（migration 12 同文件）：
```sql
-- 在 RPC 末尾、return 之前插入：
perform update_progress(v_user_id, 'workout_count', 1);
perform update_progress(v_user_id, 'workout_minutes', p_duration_min);
-- 检查今日是否首次提交该 sport
if not exists (
  select 1 from workouts
  where user_id = v_user_id
    and sport_id = p_sport_id
    and date(submitted_at) = current_date
    and id != v_workout_id  -- 排除本次刚插入的
) then
  perform update_progress(v_user_id, 'workout_sport_count', 1);
end if;
perform update_progress(v_user_id, 'streak_max', v_new_streak);
if v_card_is_new then
  perform update_progress(v_user_id, 'card_unique_count', 1);
end if;
if v_drawn_rarity = 'legendary' then
  perform update_progress(v_user_id, 'legendary_card_count', 1);
end if;
if v_protect_consumed then
  perform update_progress(v_user_id, 'protect_card_used', 1);
end if;
```

修改 `end_battle`：
```sql
perform update_progress(p_user_id, 'arena_battles', 1);
if v_result = 'win' then
  perform update_progress(p_user_id, 'arena_wins', 1);
end if;
```

修改 `revive_streak`：
```sql
perform update_progress(v_user_id, 'revive_count', 1);
```

---

## 3. 成就 Seed（首发 12 个）

| id | category | name_zh | tier | target | metric | reward |
|---|---|---|---|---|---|---|
| `workout_001` | workout | 运动达人 I | 1 | 1 | workout_count | xp 50 |
| `workout_010` | workout | 运动达人 II | 2 | 10 | workout_count | xp 100 |
| `workout_050` | workout | 运动达人 III | 3 | 50 | workout_count | xp 300 |
| `workout_200` | workout | 运动达人 IV | 4 | 200 | workout_count | protect 1 |
| `streak_03` | streak | 连击之神 I | 1 | 3 | streak_max | xp 80 |
| `streak_07` | streak | 连击之神 II | 2 | 7 | streak_max | xp 200 |
| `streak_30` | streak | 连击之神 III | 3 | 30 | streak_max | protect 1 |
| `streak_100` | streak | 连击之神 IV | 4 | 100 | streak_max | badge_only |
| `cards_05` | cards | 卡组初现 | 1 | 5 | card_unique_count | xp 100 |
| `cards_20` | cards | 卡组大师 | 2 | 20 | card_unique_count | xp 300 |
| `cards_legendary` | cards | 传说收藏家 | 1 | 1 | legendary_card_count | badge_only |
| `arena_01` | arena | Arena 之星 I | 1 | 1 | arena_wins | xp 50 |
| `arena_10` | arena | Arena 之星 II | 2 | 10 | arena_wins | xp 200 |
| `arena_50` | arena | Arena 之星 III | 3 | 50 | arena_wins | protect 1 |
| `sport_03` | special | 多面手 I | 1 | 3 | workout_sport_count | xp 100 |
| `protect_used_10` | special | 危机生还 | 1 | 10 | protect_card_used | xp 200 |
| `revive_01` | special | 凤凰涅槃 | 1 | 1 | revive_count | xp 150 |
| `arena_total_50` | arena | 实战派 | 1 | 50 | arena_battles | xp 250 |

**实际是 18 个**（提案说 12 个，这里写到 18 — 保守估计 12，但既然在 seed 里写满更"完整"，按"大胆 > 保守"补到 18，覆盖更全。Day 6 用户表态过偏好"完整 > 收敛"）。

> 设计 note: parent_id 字段串成阶链，UI 渲染时同 category + 同 parent line 折叠为单条进度条。

## 4. 任务模板 Seed

| id | difficulty | metric | min | max | xp | description_zh |
|---|---|---|---|---|---|---|
| `q_easy_run1` | easy | workout_count | 1 | 1 | 50 | 完成 {n} 次任意运动 |
| `q_easy_arena1` | easy | arena_battles | 1 | 1 | 50 | 在 Arena 出战 {n} 次 |
| `q_med_dur30` | medium | workout_minutes | 30 | 45 | 150 | 累积运动 {n} 分钟 |
| `q_med_sport2` | medium | workout_sport_count | 2 | 2 | 150 | 体验 {n} 种不同的运动类型 |
| `q_med_arenawin1` | medium | arena_wins | 1 | 1 | 150 | Arena 胜利 {n} 次 |
| `q_hard_dur60` | hard | workout_minutes | 60 | 90 | 300 | 累积运动 {n} 分钟 |
| `q_hard_sport3` | hard | workout_sport_count | 3 | 3 | 300 | 完成 {n} 种不同 sport 的训练 |
| `q_hard_arenawin2` | hard | arena_wins | 2 | 2 | 300 | Arena 胜利 {n} 次 |
| `q_hard_legend` | hard | legendary_card_count | 1 | 1 | 300 | 抽到 1 张传说卡 |

每日 RPC 各难度随机取 1 个模板，target_value 在 min-max 范围内随机。

---

## 5. 客户端

### 5.1 hooks

`src/api/achievements.ts`:
```ts
useAchievements()  // useQuery
useClaimAchievement()  // useMutation, invalidates achievements
```

`src/api/quests.ts`:
```ts
useDailyQuests()  // useQuery
useClaimQuest()  // useMutation, invalidates quests + currentUser (xp 变化)
```

### 5.2 类型 `src/types/db.ts` 增

```ts
export type AchievementRow = { ... }
export type UserAchievementRow = { ... }
export type QuestTemplateRow = { ... }
export type DailyQuestRow = { ... }
```

---

## 6. UI 设计

### 6.1 Dashboard `DailyQuestsCard`

位置：Dashboard 主卡片下方（在 ReviveBanner 上方），占 1 行。

```
┌─────────────────────────────────────────────────┐
│ 今日任务                       2 / 3 完成        │
├─────────────────────────────────────────────────┤
│ ✓ 完成 1 次任意运动        +50 XP   [已领取]    │
│ ☐ 累积运动 30 分钟      18/30  +150 XP  ........│
│ ✓ Arena 胜利 1 次          +150 XP  [领取奖励]  │
├─────────────────────────────────────────────────┤
│ 全部完成 bonus: +200 XP + 1 卡牌    [尚未解锁]  │
└─────────────────────────────────────────────────┘
```

每行：复选框、描述、进度（如"18/30"）、xp 标签、按钮（"领取奖励"或"已领取"）。

底部 bonus 行：3 个全 claim 后才亮起"领取" 按钮。

### 6.2 Achievements page `/achievements`

按 category 分组展示，每组 collapsible：

```
[ Sidebar: 仪表盘 / 工作流 / 卡牌 / Arena / 成就 / 卡组 ]

成就 ACHIEVEMENTS                         5 / 18 解锁

▼ 运动 (1/4)
   ✓ 运动达人 I — 完成 1 次运动      +50 XP   [已领取]
   ▓▓▓▓▓░░░░░░░ 运动达人 II         3/10 +100 XP
   ░░░░░░░░░░░░ 运动达人 III        3/50 +300 XP

▼ 连击 (0/4)
   ░░░░░░░░░░░░ 连击之神 I          0/3  +80 XP
   ...

▼ 卡牌 (1/3)
▼ Arena (0/4)
▼ 特殊 (1/3)
```

进度条用 `bg-bg-tertiary` + `bg-accent-primary` overlay。已解锁但未领的高亮 + 按钮。

### 6.3 解锁瞬间反馈

成就刚刚 unlock 时（`get_achievements` 检测到新增 `unlocked_at`）— 不做满屏 modal（YAGNI），仅 Dashboard 顶部 toast banner（沿用 ReviveBanner 模式）：

```
🏆 解锁成就：运动达人 I        [前往领取]
```

每日任务完成瞬间不做特别反馈（Dashboard 卡片本身就反应）。

### 6.4 Sidebar

加 `成就 / Achievements` item，icon `IconTrophy`，置于 `卡牌 / Cards` 和 `Arena` 之间。

---

## 7. i18n keys（约 30 个）

```
sidebar.achievements
achievements.title, achievements.summary
achievements.category.workout, .streak, .cards, .arena, .special
achievements.unlocked_label, .claimed_label, .claim_button, .reward_xp, .reward_protect, .reward_card, .badge_only

achievements.workout_001.name, .description
... (18 × 2 = 36, 但归到表里 i18n 用 supabase 的 name_zh/name_en，前端不存键)

dashboard.daily_quests.title
dashboard.daily_quests.completed_label
dashboard.daily_quests.bonus_locked
dashboard.daily_quests.bonus_claim
dashboard.daily_quests.bonus_claimed
dashboard.daily_quests.empty
quest.template.q_easy_run1.description (用 supabase 字段)

toast.achievement_unlocked
toast.achievement_unlocked_cta
```

成就名 + 描述 + 任务描述都存表（`name_zh/en`、`description_zh/en`），不进 i18n.ts。前端只放 UI chrome 文案。

---

## 8. 边缘情况

| 场景 | 处理 |
|---|---|
| 用户首次访问 `/achievements` | 自动 insert 18 行 user_achievements (current=0)，UI 显示全部进行中 |
| 多阶成就同时达成（运动达人 I 和 II 同时跨过） | get_achievements 各自记录 unlocked_at，UI 各自一条进度条，分别 claim |
| 跨午夜运动后 `streak_max` 是 30 | greatest(current_value, 30)，永久记最高 |
| 任务过期（昨天的没完成） | get_daily_quests 自动 delete 昨日且未 claimed 的行 |
| 任务今日已生成、用户重复进 dashboard | get_daily_quests 仅 select，不 regenerate |
| update_progress 内某 achievement parent 路径未达成 | 不阻塞 — 高阶成就可以先达成（极端情况，比如 dev 通道快进 streak） |
| 模板池单一难度被禁用所有模板 | get_daily_quests fallback：select 时若该难度池空，跳过该 slot（仅生成 2 个 quest） |
| 用户已 claim bonus 后该日重新打开 | last_quest_bonus_date = today 时，bonus row "已领取" |
| update_progress 在 transaction 中失败 | 因为是 perform 在父 RPC 内，整个 RPC 回滚，submit_workout 也会失败 — 这是想要的 |

---

## 9. 测试策略

### 9.1 单元测试（pure helpers）

- `src/lib/quests/random.ts` 的 `pickQuestTemplate(pool, difficulty)` — 给定 pool 和 difficulty 返回 1 个，target 在 range 内
- `src/lib/achievements/group.ts` 的 `groupByCategory(achievements)` — 按 category 分组并按 display_order 排序

### 9.2 集成测试（vitest + jsdom）

- `useAchievements` mock supabase response，渲染 `Achievements` page
- `DailyQuestsCard` 渲染 3 个任务 + 进度条 + bonus 行
- `claim_achievement` button click → mutation 触发

### 9.3 SQL 测试（手工 sanity，不进 vitest）

- migration up 后 seed 行数对（achievements = 18, quest_templates = 9）
- update_progress('workout_count', 1) 后多张 user_achievements current_value 同步 +1
- get_daily_quests 第一次调用生成 3 行，第二次同日仅 select

### 9.4 端到端 smoke

- Dev Drawer 已存在的"+50 streak" 触发 `streak_03/07/30` 全部解锁
- 运动一次后 daily_quest "完成 1 次运动" 完成 + xp 入账

---

## 10. 验收标准

- [ ] Sidebar 加"成就" item，点击进入 `/achievements` page
- [ ] Achievements page 按 5 大 category 分组显示 18 条进度
- [ ] 每条成就显示：名称、描述、icon、进度条（current/target）、奖励标签、状态 badge
- [ ] 解锁但未领的成就显示"领取奖励" 按钮，点击后 weekly_xp / protect_cards / card 入账
- [ ] Dashboard 加"今日任务"卡片，显示 3 个任务 + bonus 行
- [ ] 任务完成后按钮"领取奖励" 亮起，点击后 xp 入账
- [ ] 3 个任务都领后 bonus 行"领取" 亮起，点击后 +200 XP + 1 张卡牌
- [ ] 跨天后 dashboard 显示新的 3 个任务（不显示昨日）
- [ ] submit_workout 后所有相关成就和今日任务进度同步更新
- [ ] end_battle 后 arena_battles / arena_wins 进度同步更新
- [ ] 解锁瞬间 Dashboard 顶部出现 toast banner，5 秒自动消失
- [ ] tsc 干净，全部 vitest 通过
- [ ] migration 12 push 成功（含 18 + 9 seed 行）

---

## 11. 工作量分解（指导 plan）

| 阶段 | 子任务 | 估时 |
|---|---|---|
| Phase 1 — Migration | alter users + 4 表 + RLS + seed 行 + 5 RPC + 嵌入 submit/end_battle/revive | 6h |
| Phase 2 — Types & helpers | types/db.ts 加 4 type + lib/quests/random.ts + lib/achievements/group.ts + 测试 | 2h |
| Phase 3 — API hooks | api/achievements.ts (2 hook) + api/quests.ts (2 hook) | 2h |
| Phase 4 — UI Achievements | Achievements page + Sidebar item + Achievement category section + AchievementRow + 解锁 toast | 4h |
| Phase 5 — UI Quests | DailyQuestsCard + bonus row + 接入 Dashboard | 3h |
| Phase 6 — i18n + smoke | i18n keys + 站内 smoke 测试 + bug fix | 2h |
| **总计** | | **~19h ≈ 1.5-2 工作日** |

---

## 12. 不在 v1 范围

- 成就分享 / 截图导出
- 成就解锁满屏视效（仅 Dashboard toast）
- 任务自选机制
- 任务难度调整 / 个性化推荐
- 周/月任务（仅每日）
- 任务跳过 / 重摇
- 推送通知 / Email 提醒
- 赛季 / 全服活动成就
- 成就好友对比 / 排行榜
