# Day 11 Plan — 朋友 PVP

**Spec:** [`../specs/2026-05-10-day11-friend-pvp-design.md`](../specs/2026-05-10-day11-friend-pvp-design.md)

## 实施顺序

按"backend → types → hooks → UI → 验收"，每块独立 commit。

---

### Step 1 — migration 18: friendships + 5 RPC + handle_new_user 增强

**文件：** `supabase/migrations/20260510000018_day11_friendships.sql`

10 个 section：
1. `create table public.friendships`（双行模型，pending/active）
2. RLS：`select` allow when user_id=auth.uid() OR friend_id=auth.uid()，其余 deny
3. `send_friend_request(p_to uuid)` — 校验 to ≠ self / 不存在重复行 → insert (me, to, 'pending')
4. `accept_friend_request(p_from uuid)` — 校验存在 (from, me, 'pending') → update 该行 active + insert (me, from, 'active')
5. `decline_friend_request(p_from uuid)` — delete (from, me, 'pending')
6. `cancel_friend_request(p_to uuid)` — delete (me, to, 'pending')
7. `unfriend(p_friend uuid)` — delete (me, p_friend) + (p_friend, me)
8. `list_friends()` — return jsonb `{active, incoming, outgoing}` with full user metadata join
9. 改造 `handle_new_user()`：在 onboarded_at trigger 之外，注册时给该 user 一条来自随机 demo 用户的 incoming pending + 一条 active 双向（跟另一随机 demo），on conflict do nothing
10. grants

**验收：** push 后用 `psql` 跑 `select * from friendships limit 5` 看不到 RLS 报错；用任一 anon JWT 调 `list_friends` 返回 jsonb。

---

### Step 2 — migration 19: PVP battle

**文件：** `supabase/migrations/20260510000019_day11_pvp_battle.sql`

3 个 section：
1. `start_pvp_battle(p_opponent_id uuid)`：
   - 校验 opponent ≠ self
   - 校验是 active friend (`select 1 from friendships where user_id=me and friend_id=opp and status='active'`)
   - 校验双方都有 8 张 active deck
   - insert battles row (attacker_id=me, defender_id=opp, npc_id=null, decks)
   - return jsonb `{battle_id, attacker_deck_ids, defender_deck_ids, opponent_username, opponent_level}`
2. 替换 `finalize_battle(p_battle_id, p_log)`：
   - 加 PVP 分支：当 `v_battle.npc_id is null and v_battle.defender_id is not null`
   - 16 entries 校验保留
   - 赢方 +30 season_score，输方 max(0, season_score - 5)
   - 不给 XP / 不查 xp_bonus
   - 双方 user 行同步 update
3. grants

**验收：** PVP 全程：start → log 16 → finalize → 双方 season_score 各自 ±。PVE 回归仍通过现有动画路径。

---

### Step 3 — migration 20: demo seed

**文件：** `supabase/migrations/20260510000020_day11_demo_friends_decks.sql`

3 个 section：
1. 8 demo 用户互相组 5 条 active 友谊（10 行双向）
2. 每位 demo 用户设 active deck：
   ```sql
   update public.decks
     set card_ids = (select array_agg(card_id) from (
       select card_id from public.user_cards uc
         join public.cards c on c.id = uc.card_id
         where uc.user_id = decks.user_id
         order by case c.rarity when 'legendary' then 1 when 'epic' then 2 when 'rare' then 3 else 4 end
         limit 8
     ) t)
     where user_id::text like '0000000_-000_-400_-800_-%' and is_active = true;
   ```
3. 注意：上面假设每位 demo 都已经 ≥ 8 cards。Day 9 的 user_cards seed 给每位 ≥ 11 张（3 + level × 2，最低 level 4 → 11），OK。

**验收：** `select user_id, array_length(card_ids,1) from decks where user_id like '...'` 全部 = 8。

---

### Step 4 — 前端 types + api hooks

**文件：**
- `src/types/db.ts`：加 FriendshipRow、FriendListItem、FriendList、PvpStartResp
- `src/api/friends.ts`：useFriendsList / useSendFriendRequest / useAcceptFriendRequest / useDeclineFriendRequest / useCancelFriendRequest / useUnfriend
- `src/api/pvpBattle.ts`：useStartPvpBattle

每个 hook 走 `supabase.rpc(name as never, args as never)` 模式（CLAUDE.md gotcha），onSuccess invalidate `['friends']` queryKey。

---

### Step 5 — Friends page

**文件：**
- `src/pages/Friends.tsx`：3 tab + 列表 + Empty state
- `src/components/friends/FriendCard.tsx`：active friend 卡片，含发起 PVP 按钮
- `src/components/friends/InviteRow.tsx`：incoming/outgoing pending 行
- `src/lib/i18n.ts`：加 `friends.*` keys × 2 langs（约 15 个）
- `src/App.tsx`：加 `/friends` 路由

**点 "发起 PVP" 按钮 →** `useStartPvpBattle.mutate(friend.user_id)` → onSuccess `navigate('/arena/battle/:id', { state: { startResult }})`。复用现有 ArenaBattle 路由。

---

### Step 6 — Sidebar + Leaderboard + ArenaBattle/Result 兼容

1. **Sidebar.tsx**：NAV 数组加 `{to: '/friends', key: 'nav.friends', icon: 'ti-users'}`，插在 leaderboard 之前
2. **LeaderboardRow.tsx**：右侧加 "+" / "✓ 朋友" / "等待..." 按钮，根据 friendship_status 切换；点击调 `send_friend_request`
3. **Leaderboard.tsx**：拉 useFriendsList()，前端 join：把每个 entry.user_id 跟 friends 数据 merge 出 friendship_status
4. **ArenaBattle.tsx / ArenaResult.tsx**：fallback chain 处理 npc_name_zh ?? opponent_username

---

### Step 7 — 验收

```bash
bunx tsc --noEmit
bun run test
bun run build
```

`/browse` smoke：
- 注册新 anon → /friends 看到 1 active + 1 incoming（trigger 增强）
- 接受 incoming → active 数变 2
- /leaderboard 点 "+" → 进对方 outgoing
- /friends 选 active friend 点"发起 PVP" → 跳 /arena/battle/:id → 走完动画 → result 显示对手 username + season_score 变化
- /arena PVE 仍正常

---

## 涉及文件清单

| 文件 | 改动 |
|---|---|
| `supabase/migrations/20260510000018_day11_friendships.sql` | 新建：表 + 5 RPC + list_friends + handle_new_user |
| `supabase/migrations/20260510000019_day11_pvp_battle.sql` | 新建：start_pvp_battle + finalize_battle replace |
| `supabase/migrations/20260510000020_day11_demo_friends_decks.sql` | 新建：demo friends + decks seed |
| `src/types/db.ts` | 加 friendship/pvp types |
| `src/api/friends.ts` | 新建 6 hooks |
| `src/api/pvpBattle.ts` | 新建 1 hook |
| `src/pages/Friends.tsx` | 新建 |
| `src/components/friends/FriendCard.tsx` | 新建 |
| `src/components/friends/InviteRow.tsx` | 新建 |
| `src/components/Sidebar.tsx` | NAV 加 friends |
| `src/components/leaderboard/LeaderboardRow.tsx` | 加 +/✓/等待 按钮 |
| `src/pages/Leaderboard.tsx` | join useFriendsList |
| `src/pages/ArenaBattle.tsx` | fallback opponent name |
| `src/pages/ArenaResult.tsx` | fallback opponent name + score delta 显示 |
| `src/App.tsx` | route /friends |
| `src/lib/i18n.ts` | friends + nav.friends keys × 2 |
| `README.md` | （可选）补一段 social loop |

## 不动的文件

- 任何 src/store/* — 无新 store
- daily quests / achievements — 无新 progress hook（PVP wins 不算成就 metric，避免范围扩散）
- workouts / loot / streak — 无关
