# Day 11 — 朋友 PVP（社交循环）

**日期：** 2026-05-10
**目标：** 把 Day 5 的单机 PVE Arena 扩成社交 PVP 循环。评审打开链接，看到 demo 用户作为朋友直接发起 PVP 对战。

## 1. 背景

Day 1-10 单机循环完整：打卡 → 抽卡 → Arena PVE → Leaderboard。但 Leaderboard 只是被动对比 score，**没有交互**。

Day 11 加社交层：
- 加朋友 → 看朋友打卡进度 / 发起 PVP
- PVP 一回合结算，赢家 +30 season_score，输家 -5（保底 0）
- 8 名 demo 用户充当"现成朋友池"，评审一开 friends 页就能直接打

**为什么不做 chat / 通知 / feed：** 1 天 scope，先做最核心的社交动作"加朋友 + 发起 PVP"，让产品思考完整度跨越式提升。其他细节扔到 backlog。

## 2. 数据模型

### 2.1 复用现有 `battles` 表（不改 schema）

现有字段已经支持 PVP：
- `attacker_id` (uuid not null) — 发起方
- `defender_id` (uuid nullable) — PVP 时填对手 user_id；PVE 时为 null
- `npc_id` (text nullable, FK) — PVE 时填；PVP 时为 null
- `attacker_deck_ids`, `defender_deck_ids` — 双方 8 张 deck 快照
- `winner_id`, `attacker_xp_delta`, `season`, `log`

判断 PVP/PVE：`npc_id is null and defender_id is not null` → PVP；`npc_id is not null` → PVE。

### 2.2 新表：`friendships`

```sql
create table public.friendships (
  user_id   uuid not null references public.users(id) on delete cascade,
  friend_id uuid not null references public.users(id) on delete cascade,
  status    text not null default 'pending'
    check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id != friend_id)
);
create index friendships_friend_idx on public.friendships (friend_id, status);
```

**双行模型：**
- 邀请：A → B `insert (A, B, 'pending')`（一行）
- 接受：B 同意 → `update where (A,B) status='active'` + `insert (B, A, 'active')` → 共 2 行 active
- 拒绝：B 拒绝 → `delete where (A,B) status='pending'`
- 取消：A 取消 → `delete where (A,B) status='pending'`
- 删朋友：双向 `delete where (user_id, friend_id) in ((A,B), (B,A))`

每次查"我的朋友" `select friend_id from friendships where user_id = me and status='active'`，无需 union。

**RLS：** 用户只能 select 涉及自己的行（`user_id = auth.uid() or friend_id = auth.uid()`）；insert / update / delete 都通过 RPC，RLS 默认 deny。

## 3. RPC

### 3.1 friendships 相关（5 个）

| RPC | 入参 | 行为 |
|---|---|---|
| `send_friend_request(p_to uuid)` | 对方 user_id | 校验 to ≠ self / 关系不存在 → insert (me, to, 'pending') |
| `accept_friend_request(p_from uuid)` | 发起方 user_id | update (from, me) → 'active'；insert (me, from, 'active') |
| `decline_friend_request(p_from uuid)` | 发起方 user_id | delete (from, me, 'pending') |
| `cancel_friend_request(p_to uuid)` | 对方 user_id | delete (me, to, 'pending') |
| `unfriend(p_friend uuid)` | 朋友 user_id | delete (me, p_friend) + (p_friend, me) |

### 3.2 list_friends() 复合查询

返回 3 块：
```jsonb
{
  "active": [{user_id, username, level, season_score, current_streak, last_workout_date}],
  "incoming": [{user_id, username, level, season_score}],   -- 别人发给我的 pending
  "outgoing": [{user_id, username, level, season_score}]    -- 我发给别人的 pending
}
```

### 3.3 PVP battle 相关

**`start_pvp_battle(p_opponent_id uuid)`：**
- 校验：opponent ≠ self；双方是 active friend；双方都有 8 张 active deck
- 取双方 active deck card_ids
- insert battles row（`attacker_id=me, defender_id=opponent, npc_id=null`）
- 返回 `{battle_id, attacker_deck_ids, defender_deck_ids, opponent_username, opponent_level}`

**改造 `finalize_battle(p_battle_id, p_log)`：**
- 现有：检测 npc_id → 算 reward_xp + xp_bonus → 赢家 +XP + season_score
- 新增：当 `npc_id is null and defender_id is not null` 时走 PVP 分支
  - log 还是 16 entries（双方 deck 8v8 对撞）
  - PVP **不给 XP**（XP 是运动激励，不是 PVP 奖励）
  - 赢家 season_score `+30`，输家 `max(0, season_score - 5)`
  - 双方 user 行同步更新

## 4. UI

### 4.1 新 page `/friends`

3 个 tab：

```
[ 我的朋友 N ]  [ 收到 N ]  [ 发出 N ]
```

**我的朋友 tab：** 每行
- avatar (用 username 首字母 placeholder)
- username + L{level} + 今日 streak
- season_score
- "发起 PVP" 按钮（绿色，需对方有 active deck 时才能点）
- "..." 删朋友（次要）

**收到 tab：** 每行
- 对方 username + L + season_score
- "接受" / "拒绝" 两个按钮

**发出 tab：** 每行
- 对方 username + 状态文字"等待对方接受"
- "撤回" 按钮

空状态：每个 tab 给一段提示 + Link 到 `/leaderboard`（"在排行榜里加朋友 →"）。

### 4.2 Leaderboard 加 "+加朋友" 按钮

每个 LeaderboardRow 右侧除了 score 数字，还显示一个 "+" 按钮：
- 点击 → 调 `send_friend_request`
- 已经是朋友：显示 "✓ 朋友"（disabled）
- 已发出邀请：显示 "等待..." (disabled)
- 自己：不显示按钮
- 收到对方邀请：显示 "接受" 按钮

为支持上面 4 种状态，list_leaderboard 要返回每个 user 的 `friendship_status`：'self' / 'active' / 'outgoing' / 'incoming' / 'none'。

实施考虑：避免改 leaderboard RPC（已经返回 dense_rank + entries）。改用前端 join：拉 `useLeaderboard()` + `useFriendsList()`，前端 merge `friendship_status`。

### 4.3 ArenaBattle / ArenaResult 兼容 PVP

现状：通过 `state.startResult.npc_name_zh` / `npc_level` 显示对手。

PVP 时 `start_pvp_battle` 返回 `opponent_username` / `opponent_level`，把这两个字段也加到 startResult，UI 用条件渲染：
- 有 npc_name_zh → 显示 NPC
- 否则用 opponent_username

ArenaResult 页面不需大改 —— xp_gained 显示 0（PVP 不给 XP），season_score 增减能算出。

### 4.4 Sidebar nav

加一个 entry，icon `ti-users`，i18n key `nav.friends`，路由 `/friends`。位置插在 leaderboard 之前（社交相关聚类）。

## 5. Demo Seed（migration 20）

8 名 demo 用户：
- 互相组成 5 条朋友关系（不全连，模拟真实 graph）：
  - speedster_777 ↔ iron_will_42
  - speedster_777 ↔ hiit_demon
  - iron_will_42 ↔ flexible_jane
  - cardio_lord ↔ hiit_demon
  - cardio_lord ↔ basket_king

- 每位 demo 设 active deck（从他们的 user_cards 里挑 8 张：rarity 高的优先）

- 给 anonymous 当前用户额外的"现成体验"：
  - 不能在 migration 里硬塞当前评审 user_id（每次评审 anon UUID 不同）
  - 改用 `handle_new_user` trigger 增强：注册时随机给该用户 1 active demo 朋友 + 1 incoming pending demo 邀请
  - 这样评审一开 friends 页就有事看：1 个朋友 + 1 个待接受邀请

## 6. 不做的事

- ❌ chat / 私信
- ❌ activity feed（朋友动态）
- ❌ 朋友打卡通知 / push
- ❌ 朋友 mutual count / 推荐算法
- ❌ block / 屏蔽
- ❌ PVP 排位 / 段位 / matchmaking
- ❌ PVP 重赛（赢一次就好，rate-limit 留给后续）

## 7. 验收

- [ ] `bunx tsc --noEmit` clean
- [ ] `bun run test` all pass
- [ ] `bun run build` success
- [ ] migration 18/19/20 成功 push
- [ ] 注册新账户 → /friends 看到 1 active friend + 1 incoming（来自 trigger 增强）
- [ ] 接受 incoming → 该 user 进 active；
- [ ] 进 /leaderboard → 点 "+" → 该 user 进 outgoing
- [ ] /friends 我的朋友 tab → 点"发起 PVP" → 跳 /arena/battle/:id → 动画 → /arena/result/:id 显示对手 username + season_score 增减（不给 XP）
- [ ] 在 /arena 选 PVE NPC 仍正常工作（PVE 路径回归不破）

## 8. 风险

| 风险 | 缓解 |
|---|---|
| handle_new_user trigger 改了，老用户 + 新用户行为分叉 | trigger 只在新注册时跑，老用户不受影响；每次注册随机 demo 朋友是幂等的（select random + insert on conflict do nothing） |
| 8 demo 用户没设 deck → start_pvp_battle 报"need 8 cards" | migration 20 第二段强制给每位 demo 设 active deck |
| finalize_battle 改造打破 PVE | PVP 分支用条件 `if v_battle.npc_id is null and v_battle.defender_id is not null then ...`，PVE 走原逻辑 |
| RLS 让 leaderboard 看不到 demo 用户的 username | demo 用户跟普通用户一样，users 表 RLS 应该 select-all（已是这样） |
| ArenaBattle 动画里调用了 npc 字段 → PVP 时 undefined | 前端拉 startResult，做 fallback chain `npc_name_zh ?? opponent_username` |

## 9. 时间预算

| 块 | 估时 |
|---|---|
| spec | 30 min ✓ |
| plan | 20 min |
| migration 18 friendships + 5 RPC | 60 min |
| migration 19 PVP battle | 60 min |
| migration 20 demo seed | 30 min |
| 前端 types + hooks | 30 min |
| Friends page | 90 min |
| Leaderboard "+" + ArenaBattle 兼容 | 60 min |
| Sidebar + i18n | 20 min |
| 验收 + smoke | 30 min |
| **合计** | **~ 7 小时** |

1 天满。如果超时，把 ArenaBattle 动画 / Leaderboard "+" 中任一块挪到 Day 12。

## 10. 后续 backlog

- chat / 私信
- 活动 feed（朋友打卡 / 朋友升级）
- PVP 段位 / matchmaking
- 朋友推荐算法
- 朋友 push / 提醒
