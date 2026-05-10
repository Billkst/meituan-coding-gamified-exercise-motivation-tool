# Day 6 — Onboarding + 保护卡 + 复活 + Dev Menu Design

**Date:** 2026-05-10
**Status:** APPROVED (sections A–E user-confirmed)
**Source route:** gstack 16-day plan, 原 Day 7 内容（Day 5/6 合并提前完成 Arena）

## Goal

为评审打开测评 URL 后能在 10 分钟内 100% 触发 3 wow + 演示 streak 数学闭环。具体：

- 首次访问 anon 用户走 5 步 onboarding（90s 预算），step 4 抽到保底 epic 卡（Wow #1）
- 保护卡机制（每周自动 1 张 / 上限 3 / streak 当日断裂自动消耗）
- 复活机制（streak 完全断后 7 天内可复活，free 但 50% XP 冻结 24h）
- Dev Menu (`?dev=1` 触发) 让评审 5 秒内手动触发任意状态

## Premises

- gstack 主 design v4 已锁定，本 spec 是其 Day 7 节落地细节
- Schema Day 2 已建好基础，本 spec 仅做增量 alter
- 测评作业语境 → Dev Menu 不需要严格权限（README 不暴露 dev URL 即足够）
- 16 天总 plan 中 v1 不做：跨设备 onboarding 同步、复活二次确认 modal、Wow #2/#3 满屏视效

## Architecture

**Schema First** 路径：先 alter users + 写 RPC，再写 zustand store + 路由 gate + UI。

层次：
1. **Server (Supabase RPC):** 4 个改动 — `submit_workout` 改造 + 3 个新 RPC
2. **Client state (zustand):** 1 个新 store — `useDevStore`
3. **Router gate:** `OnboardingGate` 组件包裹全局 routes
4. **UI components:** Onboarding 5 步 + ReviveBanner + DevDrawer + freeze ❄️ overlay
5. **i18n:** ~45 keys × 2 lang

---

## 1. 数据模型

### 1.1 users 表 alter（migration 11）

```sql
alter table public.users
  add column onboarded_at timestamptz,
  add column freeze_xp_until timestamptz,
  add column last_protect_grant_at timestamptz;

update public.users set last_protect_grant_at = created_at where last_protect_grant_at is null;
```

| 字段 | 类型 | 含义 |
|---|---|---|
| `onboarded_at` | timestamptz null | null = 未引导。step 5 完成时写入。OnboardingGate 据此跳转 |
| `freeze_xp_until` | timestamptz null | 复活产生的 XP 冻结期截止时间。`now() < freeze_xp_until` = 冻结中 |
| `last_protect_grant_at` | timestamptz | 上次发保护卡时间。初始化 = `created_at` |

既有 `protect_cards int default 0` 字段不改名（design doc 写的是 protection_cards 但代码已实现为 protect_cards，保持一致）。

### 1.2 streak 表无改动

`streaks.status` 已有枚举位置 `'active' | 'broken' | 'protected' | ...`（Day 2 schema），protect 路径写 `'protected'`。

---

## 2. RPC 设计

### 2.1 改造 `submit_workout`（migration 11 同文件）

新增 4 个行为，集中一次 alter 避免多版本：

```
1. 冻结期检查
   v_is_frozen := v_user.freeze_xp_until is not null and v_user.freeze_xp_until > now()
   if v_is_frozen then v_xp_gained := 0
   （冻结期内仍发卡 + 仍计 streak，只 XP 归零）

2. streak 计算 gap > 1 时优先消耗保护卡
   when (today - last_workout_date) > 1:
     if v_user.protect_cards >= 1 then
       v_protect_consumed := true
       v_user.protect_cards -= 1
       v_new_streak := v_user.current_streak + 1
       v_streak_status := 'protected'
     else
       v_new_streak := 1
       v_streak_status := 'broken'

3. 周发保护卡
   if (now() - v_user.last_protect_grant_at >= interval '7 days')
      and v_user.protect_cards < 3 then
     v_protect_granted := true
     v_user.protect_cards += 1
     v_user.last_protect_grant_at := now()
   （注意：补发只发 1 张，不论隔了多少周）

4. 返回结构扩展
   {
     ...existing fields,
     xp_frozen: boolean,
     protect_card_consumed: boolean,
     protect_card_granted: boolean,
     protect_cards_after: int,
     freeze_xp_until: timestamptz | null
   }
```

### 2.2 新 `revive_streak()` RPC

```sql
create or replace function public.revive_streak()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user users%rowtype;
  v_last_streak_len int;
  v_revived int;
  v_freeze_until timestamptz;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select * into v_user from users where id = v_user_id for update;
  if not found then raise exception 'user not found' using errcode = '22023'; end if;

  -- 防止反复复活
  if v_user.freeze_xp_until is not null and v_user.freeze_xp_until > now() then
    raise exception 'already revived' using errcode = '28000';
  end if;

  -- 7 天窗口
  if v_user.last_workout_date is null
     or v_user.last_workout_date < (current_date - 7) then
    raise exception 'revive window closed' using errcode = '22023';
  end if;

  if v_user.current_streak <> 0 then
    raise exception 'streak not broken' using errcode = '22023';
  end if;

  -- 取上次 broken streak 的长度
  select length into v_last_streak_len
    from streaks
    where user_id = v_user_id and status = 'broken'
    order by start_date desc limit 1;

  v_revived := floor(coalesce(v_last_streak_len, 0) / 2.0);
  v_freeze_until := now() + interval '24 hours';

  update users set
    current_streak = v_revived,
    freeze_xp_until = v_freeze_until
    where id = v_user_id;

  -- 写一条新 streak period
  insert into streaks (user_id, start_date, length, status)
  values (v_user_id, current_date, v_revived, 'active');

  return jsonb_build_object(
    'revived_streak', v_revived,
    'freeze_until', v_freeze_until
  );
end; $$;

grant execute on function public.revive_streak() to authenticated;
```

### 2.3 新 `grant_onboarding_pack()` RPC

```sql
create or replace function public.grant_onboarding_pack()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user users%rowtype;
  v_pack jsonb;
  v_epic_card cards%rowtype;
  v_random1 cards%rowtype;
  v_random2 cards%rowtype;
begin
  if v_user_id is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v_user from users where id = v_user_id for update;

  -- idempotent
  if v_user.onboarded_at is not null then
    select jsonb_agg(jsonb_build_object('id', c.id, 'rarity', c.rarity))
      into v_pack
      from user_cards uc join cards c on c.id = uc.card_id
      where uc.user_id = v_user_id
      order by c.rarity desc;
    return jsonb_build_object('cards', v_pack, 'idempotent', true);
  end if;

  -- 1 张保底 epic（随机选 1 张 epic card）
  select * into v_epic_card from cards where rarity = 'epic' order by random() limit 1;
  insert into user_cards (user_id, card_id, copies) values (v_user_id, v_epic_card.id, 1)
    on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

  -- 2 张随机 common/rare
  select * into v_random1 from cards where rarity in ('common','rare') order by random() limit 1;
  insert into user_cards (user_id, card_id, copies) values (v_user_id, v_random1.id, 1)
    on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

  select * into v_random2 from cards where rarity in ('common','rare') and id <> v_random1.id
    order by random() limit 1;
  insert into user_cards (user_id, card_id, copies) values (v_user_id, v_random2.id, 1)
    on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

  update users set onboarded_at = now() where id = v_user_id;

  return jsonb_build_object(
    'cards', jsonb_build_array(
      jsonb_build_object('id', v_epic_card.id, 'rarity', 'epic'),
      jsonb_build_object('id', v_random1.id, 'rarity', v_random1.rarity),
      jsonb_build_object('id', v_random2.id, 'rarity', v_random2.rarity)
    ),
    'idempotent', false
  );
end; $$;

grant execute on function public.grant_onboarding_pack() to authenticated;
```

### 2.4 新 `dev_dispatch(action text, params jsonb)` RPC

```sql
create or replace function public.dev_dispatch(p_action text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_legendary_card cards%rowtype;
  v_n int;
begin
  if v_user_id is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- 测评作业语境：不做严格权限校验。生产环境应加 secret token。

  case p_action
    when 'set_streak' then
      v_n := coalesce((p_params->>'n')::int, 0);
      update users set current_streak = greatest(v_n, 0) where id = v_user_id;

    when 'grant_legendary' then
      select * into v_legendary_card from cards where rarity = 'legendary' order by random() limit 1;
      insert into user_cards (user_id, card_id, copies) values (v_user_id, v_legendary_card.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

    when 'level_up' then
      -- 直接 level += 1，xp 归零。简化逻辑，触发 client 端 level-up 视效。
      update users set level = level + 1, xp = 0 where id = v_user_id;

    when 'break_streak' then
      update users set
        current_streak = 0,
        last_workout_date = current_date - 1,  -- 1 天前断，进入复活窗口
        freeze_xp_until = null
        where id = v_user_id;
      -- 写一条 broken streak period
      insert into streaks (user_id, start_date, length, status)
      values (v_user_id, current_date - 10, 10, 'broken');  -- 假装上次 streak=10

    when 'reset_progress' then
      update users set
        level = 1, xp = 0, total_workouts = 0,
        current_streak = 0, longest_streak = 0,
        last_workout_date = null,
        protect_cards = 0,
        season_score = 0,
        freeze_xp_until = null,
        last_protect_grant_at = now()
        where id = v_user_id;
      delete from user_cards where user_id = v_user_id;
      delete from workouts where user_id = v_user_id;
      delete from battles where attacker_id = v_user_id;
      delete from streaks where user_id = v_user_id;

    when 'grant_protect' then
      update users set protect_cards = least(protect_cards + 1, 3) where id = v_user_id;

    when 'reset_onboarding' then
      update users set onboarded_at = null where id = v_user_id;

    else
      raise exception 'unknown action: %', p_action using errcode = '22023';
  end case;

  return jsonb_build_object('action', p_action, 'ok', true);
end; $$;

grant execute on function public.dev_dispatch(text, jsonb) to authenticated;
```

---

## 3. 客户端架构

### 3.1 zustand 新 store: `useDevStore`

```ts
// src/store/useDevStore.ts
import { create } from 'zustand'

const SS_KEY = 'pulse_dev'

type DevState = {
  isDevMode: boolean
  isPanelOpen: boolean
  enableDevMode: () => void
  disableDevMode: () => void
  togglePanel: () => void
}

export const useDevStore = create<DevState>((set) => ({
  isDevMode: typeof window !== 'undefined' && sessionStorage.getItem(SS_KEY) === '1',
  isPanelOpen: false,
  enableDevMode: () => {
    sessionStorage.setItem(SS_KEY, '1')
    set({ isDevMode: true })
  },
  disableDevMode: () => {
    sessionStorage.removeItem(SS_KEY)
    set({ isDevMode: false, isPanelOpen: false })
  },
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
}))
```

App.tsx 顶部 effect：
```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('dev') === '1') useDevStore.getState().enableDevMode()
  
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      const { isDevMode, togglePanel } = useDevStore.getState()
      if (isDevMode) togglePanel()
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### 3.2 OnboardingGate 组件

```tsx
// src/components/OnboardingGate.tsx
export default function OnboardingGate({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()
  const { isDevMode } = useDevStore()
  const forceParam = new URLSearchParams(location.search).get('force') === '1'

  if (isLoading || !user) return <>{children}</>  // 不阻塞，让 BootScreen 处理

  const isOnboarded = user.onboarded_at != null
  const onOnboardingPath = location.pathname === '/onboarding'

  if (!isOnboarded && !onOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }
  if (isOnboarded && onOnboardingPath && !(isDevMode && forceParam)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
```

放在 App.tsx 的 Sidebar/main 之间：
```tsx
<main className="flex-1 ml-[240px]">
  <OnboardingGate>
    <Routes>...</Routes>
  </OnboardingGate>
</main>
```

### 3.3 路由 — 现有 /onboarding 改造

```tsx
// src/pages/Onboarding.tsx 完全重写
// 内部状态机 step 1-5，不拆子路由
// query ?step=N 持久化

const STEPS = [Step1Welcome, Step2Sports, Step3MockWorkout, Step4LootReveal, Step5DashboardOverlay]

export default function Onboarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const stepNum = Math.min(5, Math.max(1, parseInt(searchParams.get('step') ?? '1')))
  const StepComp = STEPS[stepNum - 1]
  const goNext = () => setSearchParams({ step: String(stepNum + 1) })
  const goPrev = () => setSearchParams({ step: String(stepNum - 1) })

  return (
    <div className="fixed inset-0 bg-bg-primary z-onboarding flex flex-col">
      <ProgressDots current={stepNum} total={5} />
      <StepComp onNext={goNext} onPrev={goPrev} />
    </div>
  )
}
```

---

## 4. UI 规格

### 4.1 Onboarding 5 步

#### Step 1: Welcome (15s)
```
全屏黑底
顶部 ProgressDots: ● ○ ○ ○ ○
中央：
  PULSE 大字 (font-display 96px text-accent-primary)
  副标题 "练得越久，奖励越值得肝" (font-mono 18px)
底部 CTA "开始" → onNext
```

#### Step 2: Sport selection (15s)
```
ProgressDots: ● ● ○ ○ ○
标题 "你想从哪些运动开始？"
26 项运动 grid (5×6)，每个 cell:
  - 上：sport icon (32px)
  - 中：name_zh
  - 下：checkbox (选中时 border-accent-primary + 内填霓虹绿)
底部 chip "已选 N/3"
N>=1 时 CTA "继续" enable → 写 exploration_buffs jsonb（每个选中的 sport_id 给 +20% buff × 3 次）
```

写 buff 用现有 RPC？没有专用 RPC，复用 `dev_dispatch('set_buff', ...)`？不优雅。
**简化方案：** Step 2 选择存 client state (zustand)，到 Step 5 完成时再一次性写入。
更简化：直接前端写 supabase.from('users').update({exploration_buffs}).eq('id', uid)。anon RLS 是否允许 user 改自己的 exploration_buffs？

查 RLS：Day 2 RLS 把 users.* 写权限 revoke from authenticated（anti-cheat）。
**结论：** 必须新建 RPC `set_exploration_buffs(p_buffs jsonb)`，或合并到 `grant_onboarding_pack` 入参里。
**采用：** `grant_onboarding_pack(p_exploration_buffs jsonb)` 增加入参，step 4 调用时带过去。

修改 RPC 签名：
```sql
create or replace function public.grant_onboarding_pack(p_buffs jsonb default '{}'::jsonb) ...
  update users set 
    onboarded_at = now(),
    exploration_buffs = p_buffs
    where id = v_user_id;
```

#### Step 3: Mock workout (30s)
```
ProgressDots: ● ● ● ○ ○
标题 "提交你的第 1 次运动"
卡片样式：
  Sport: [dropdown 默认 = step 2 选的第 1 个偏好]
  Duration: [number 默认 30]
  Intensity: [chip toggle: light / medium / high，默认 medium]
"提交" 按钮 → 不调 RPC，纯前端假动画 1.5s（XP +60 数字 from 0 浮起）→ onNext
```

注意：不调 submit_workout，避免 onboarded_at 写之前用户已经有 workout 历史污染保底逻辑。

#### Step 4: Loot reveal (30s) — Wow #1
```
ProgressDots: ● ● ● ● ○
标题 "你的开局卡组"
进入时调 grant_onboarding_pack(buffs) → 拿 3 张卡
3 张卡牌样式（左中右排列）：
  - 1.0s: 卡背朝上
  - 1.0-1.6s: 顺序翻转 (左 0s, 中 0.3s, 右 0.6s, transform rotateY)
  - 中央 epic 翻完后加 0.5s 金光呼吸 + 缩放 1.0 → 1.05 → 1.0
  - 翻完显示 rarity 标签
"继续" 按钮 → onNext
```

**实施细节：** Day 4 的翻卡逻辑当前内联在 `src/pages/Loot.tsx`。Day 6 抽出一个共享组件
`src/components/cards/CardReveal3.tsx`，接受 `cards: Array<{id,rarity}>` 入参渲染 3 张顺序翻牌动画，
中央卡按 rarity 自动加金光（rarity in epic/legendary）。
Loot.tsx 改为调用该组件（小重构，但只是抽方法不改语义）。
Onboarding step 4 同样调用该组件，传 grant_onboarding_pack 返回的 3 张卡。

**幂等性：** 用户可能点 prev/next 来回切换。step 4 进入时只调一次 grant_onboarding_pack——
RPC 本身幂等（onboarded_at 已写则返回之前的 3 张卡 + idempotent: true）。
React Query 用 mutation key `['onboarding-pack']` 缓存结果。
来回切换时使用 cache 数据，不发新请求，**且若 idempotent === true 则跳过翻牌动画**直接展示已揭晓的卡。

#### Step 5: Dashboard arrow overlay (10s)
```
Step 4 完成后 → onNext 直接 navigate('/dashboard?tour=1', { replace: true })
（OnboardingGate 看到 onboarded_at 已写就不会回拦）

Dashboard.tsx 检测 ?tour=1 → 渲染 <DashboardTourOverlay />:
  - bg-black/70 fixed inset-0 z-tour
  - 3 个圆点 + 文字（不画 SVG 箭头，YAGNI）：
    ● "这是你的连续打卡天数（streak）" 定位在 streak hero 中央
    ● "断了就要复活，连了越久奖励越好" streak 下方 100px
    ● "去 Arena 用卡组挑战" 接近 Arena CTA
  - 各 ● 用 useRef 测量目标元素 bounding rect 运行时定位（fallback hardcode）
  - "完成" 按钮居中底部 → setSearchParams({}) 移除 ?tour=1 → overlay unmount

注意：onboarded_at 已经在 step 4 入口的 grant_onboarding_pack RPC 写入。
step 5 完全不调 RPC，仅做 UI 引导。
```

Step 4 失败处理：grant_onboarding_pack RPC 报错 → step 4 不允许 onNext，
显示 retry 按钮 + toast `onboarding.step4.error_retry`。这保证 step 5 进入时 onboarded_at 一定已写。

#### ProgressDots 组件

```tsx
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={
          'w-2 h-2 rounded-full transition-colors ' +
          (i < current ? 'bg-accent-primary' : 'bg-white/20')
        }/>
      ))}
    </div>
  )
}
```

### 4.2 ReviveBanner

```tsx
// src/components/ReviveBanner.tsx
export default function ReviveBanner() {
  const { data: user } = useCurrentUser()
  const revive = useReviveStreak()
  const { t } = useTranslation()

  if (!user) return null
  if (user.current_streak !== 0) return null
  if (user.freeze_xp_until && new Date(user.freeze_xp_until) > new Date()) return null
  if (!user.last_workout_date) return null

  const daysSince = differenceInDays(new Date(), new Date(user.last_workout_date))
  if (daysSince > 7 || daysSince < 1) return null

  return (
    <div className="bg-semantic-error/10 border border-semantic-error rounded-card p-4 mb-6 flex items-center gap-4">
      <IconAlertTriangle className="text-semantic-error" size={32} />
      <div className="flex-1">
        <div className="font-display font-bold uppercase text-semantic-error">
          {t('revive.banner.title', { days: daysSince })}
        </div>
        <div className="font-mono text-xs text-text-secondary">
          {t('revive.banner.subtitle')}
        </div>
      </div>
      <button
        onClick={() => revive.mutate()}
        disabled={revive.isPending}
        className="bg-semantic-error text-white font-display font-bold uppercase px-6 py-2 rounded-button"
      >
        {t('revive.cta')}
      </button>
    </div>
  )
}
```

放 Dashboard.tsx 顶部 header 之后、streak hero 之前。

### 4.3 freeze ❄️ overlay

Dashboard.tsx 的 "This Week" StatCard 改造（不全局加 store；直接在该 card 内 conditional render）：
```tsx
<div className="font-display text-3xl font-bold tabular-nums flex items-center gap-1">
  {value}
  {user?.freeze_xp_until && new Date(user.freeze_xp_until) > new Date() && (
    <IconSnowflake size={14} className="text-accent-info" 
      title={t('freeze.tooltip', { time: formatTime(user.freeze_xp_until) })}/>
  )}
</div>
```

### 4.4 DevDrawer

```tsx
// src/components/DevDrawer.tsx
export default function DevDrawer() {
  const { isDevMode, isPanelOpen, togglePanel, disableDevMode } = useDevStore()
  const dispatch = useDevDispatch()
  const qc = useQueryClient()
  const { t } = useTranslation()

  if (!isDevMode) return null

  return (
    <>
      {/* Sidebar 顶部 chip：在 Sidebar 组件里 conditional 渲染 */}
      <div className={
        'fixed bottom-0 left-[240px] right-0 bg-semantic-error/95 backdrop-blur transition-all z-dev ' +
        (isPanelOpen ? 'h-60' : 'h-0 overflow-hidden')
      }>
        <header className="flex items-center justify-between px-6 py-3 border-b border-white/20">
          <div className="font-display font-bold uppercase text-white">DEV MODE · 测评菜单</div>
          <button onClick={togglePanel}><IconX className="text-white" /></button>
        </header>
        <div className="grid grid-cols-2 gap-3 p-6">
          <DevButton onClick={() => promptAndDispatch('set_streak')}>{t('dev.actions.set_streak')}</DevButton>
          <DevButton onClick={() => dispatch.mutateAsync({ action: 'grant_legendary' })}>{t('dev.actions.grant_legendary')}</DevButton>
          <DevButton onClick={() => dispatch.mutateAsync({ action: 'level_up' })}>{t('dev.actions.level_up')}</DevButton>
          <DevButton onClick={() => dispatch.mutateAsync({ action: 'break_streak' })}>{t('dev.actions.break_streak')}</DevButton>
          <DevButton onClick={() => dispatch.mutateAsync({ action: 'grant_protect' })}>{t('dev.actions.grant_protect')}</DevButton>
          <DevButton onClick={() => dispatch.mutateAsync({ action: 'reset_onboarding' })}>{t('dev.actions.reset_onboarding')}</DevButton>
          <DevButton onClick={() => dispatch.mutateAsync({ action: 'reset_progress' })}>{t('dev.actions.reset_progress')}</DevButton>
          <DevButton onClick={disableDevMode}>{t('dev.actions.exit')}</DevButton>
        </div>
      </div>
    </>
  )
}
```

Sidebar.tsx 顶部追加：
```tsx
{isDevMode && (
  <button onClick={togglePanel}
    className="bg-semantic-error text-white font-display font-bold uppercase px-3 py-1 rounded text-xs">
    DEV
  </button>
)}
```

每个 dispatch 完成后：
```ts
onSuccess: () => qc.invalidateQueries({ queryKey: ['currentUser'] })
              + toast 'dev action <name> done'
```

---

## 5. API hooks

### 5.1 `src/api/onboarding.ts`

```ts
export function useGrantOnboardingPack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (buffs: Record<string, number>) => {
      const { data, error } = await supabase.rpc('grant_onboarding_pack', { p_buffs: buffs })
      if (error) throw error
      return data as { cards: Array<{id: string; rarity: string}>; idempotent: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      qc.invalidateQueries({ queryKey: ['myCards'] })
    },
  })
}
```

### 5.2 `src/api/revive.ts`

```ts
export function useReviveStreak() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('revive_streak')
      if (error) throw error
      return data as { revived_streak: number; freeze_until: string }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      toast.success(t('revive.success.toast', { n: data.revived_streak }))
    },
    onError: (e: any) => toast.error(t('revive.error.generic', { msg: e.message })),
  })
}
```

### 5.3 `src/api/dev.ts`

```ts
export function useDevDispatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ action, params }: { action: string; params?: any }) => {
      const { data, error } = await supabase.rpc('dev_dispatch', {
        p_action: action,
        p_params: params ?? {},
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries() // dev 可能改任何东西，全量 invalidate
    },
  })
}
```

---

## 6. 错误处理

| 场景 | 服务端 | 客户端 |
|---|---|---|
| `revive_streak` freeze 已设 | errcode 28000 | toast `revive.error.already_revived` |
| `revive_streak` 7 天窗口已过 | errcode 22023 | toast `revive.error.window_closed` |
| `revive_streak` streak 未断 | errcode 22023 | 横幅本来就不显示，理论不会到这 |
| `grant_onboarding_pack` 已 onboarded | 返回 `idempotent: true` | step 4 仍显示这 3 张卡 |
| `dev_dispatch` 未知 action | errcode 22023 | toast `dev.error.unknown_action` |
| `submit_workout` freeze + 同日 | xp_gained=0 + 同日规则照常 | 显示"已经打过卡了" |
| 网络断 step 4 | mutation 失败 | retry 按钮显示在 step 4，保留 step 状态 |

---

## 7. 测试

### 7.1 单测（Vitest，pure TS，jsdom 不需要）

`src/lib/streak/__tests__/protect.test.ts`：

```ts
import { computeNextStreak } from '../protect'
import { describe, it, expect } from 'vitest'

describe('computeNextStreak', () => {
  it('gap=1 protect=0 → continued', () => {
    expect(computeNextStreak({ gap: 1, current: 5, protect: 0 }))
      .toEqual({ next: 6, status: 'continued', protect_consumed: false, protect_after: 0 })
  })
  it('gap=2 protect=1 → protected', () => {
    expect(computeNextStreak({ gap: 2, current: 5, protect: 1 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 0 })
  })
  it('gap=2 protect=0 → broken', () => {
    expect(computeNextStreak({ gap: 2, current: 5, protect: 0 }))
      .toEqual({ next: 1, status: 'broken', protect_consumed: false, protect_after: 0 })
  })
  it('gap=3 protect=3 → protected, 余 2', () => {
    expect(computeNextStreak({ gap: 3, current: 5, protect: 3 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 2 })
  })
  it('gap=8 protect=3 → broken（保护卡只续 1 天）', () => {
    expect(computeNextStreak({ gap: 8, current: 5, protect: 3 }))
      .toEqual({ next: 1, status: 'broken', protect_consumed: false, protect_after: 3 })
  })
})
```

`computeNextStreak` 是 client-only 纯函数，作为 RPC 行为的镜像（用于客户端预期 + 单测）。RPC 是真权威。

`src/lib/streak/__tests__/revive.test.ts`：

```ts
describe('computeReviveAmount', () => {
  it('prev=10 → 5', () => expect(computeReviveAmount(10)).toBe(5))
  it('prev=1 → 0', () => expect(computeReviveAmount(1)).toBe(0))
  it('prev=0 → 0', () => expect(computeReviveAmount(0)).toBe(0))
})

describe('canRevive', () => {
  const today = new Date('2026-05-10')
  it('last 6 天前 → true', () =>
    expect(canRevive({ current_streak: 0, last_workout_date: '2026-05-04', freeze_xp_until: null }, today)).toBe(true))
  it('last 8 天前 → false', () =>
    expect(canRevive({ current_streak: 0, last_workout_date: '2026-05-02', freeze_xp_until: null }, today)).toBe(false))
  it('freeze 已设 → false', () =>
    expect(canRevive({ current_streak: 0, last_workout_date: '2026-05-04', freeze_xp_until: '2026-05-11' }, today)).toBe(false))
  it('streak>0 → false', () =>
    expect(canRevive({ current_streak: 5, last_workout_date: '2026-05-09', freeze_xp_until: null }, today)).toBe(false))
})
```

`src/lib/streak/__tests__/grant.test.ts`：

```ts
describe('shouldGrantProtect', () => {
  const now = new Date('2026-05-10T00:00:00Z')
  it('上次 6 天前 stock 2 → false', () =>
    expect(shouldGrantProtect({ last_grant: '2026-05-04T00:00:00Z', stock: 2 }, now)).toBe(false))
  it('上次 7 天前 stock 3 → false (满)', () =>
    expect(shouldGrantProtect({ last_grant: '2026-05-03T00:00:00Z', stock: 3 }, now)).toBe(false))
  it('上次 7 天前 stock 2 → true', () =>
    expect(shouldGrantProtect({ last_grant: '2026-05-03T00:00:00Z', stock: 2 }, now)).toBe(true))
  it('上次 14 天前 stock 1 → true (只补 1 张)', () =>
    expect(shouldGrantProtect({ last_grant: '2026-04-26T00:00:00Z', stock: 1 }, now)).toBe(true))
})
```

`src/components/__tests__/OnboardingGate.test.tsx`：用 jsdom + MemoryRouter，3 个 case：
- onboarded_at=null + path='/dashboard' → redirect to /onboarding
- onboarded_at set + path='/onboarding' → redirect to /dashboard
- onboarded_at set + isDevMode=true + ?force=1 → 不跳走

### 7.2 E2E 手动 smoke checklist

按 README 配置（同 Day 5 节奏）：

1. ✅ 打开 `https://...` 全新 anon
2. ✅ 自动跳 /onboarding，进入 step 1
3. ✅ Step 1 → 2，看到 26 项 grid
4. ✅ 选 3 项，CTA enable，→ 3
5. ✅ Step 3 提交假 workout，看到 +60 XP 浮字
6. ✅ Step 4 抽 3 张卡，中央 = epic + 金光呼吸（Wow #1）
7. ✅ Step 5 看到 dashboard overlay 3 个提示
8. ✅ "完成" → 跳到 dashboard，无 onboarding 残留
9. ✅ 刷新 → 仍在 dashboard（不再跳 onboarding）
10. ✅ URL 加 `?dev=1` 刷新 → DEV chip 出现在 sidebar
11. ✅ 点 DEV chip / Cmd+Shift+D → drawer 上滑
12. ✅ "Set Streak" → 输入 19 → streak hero 显示 19
13. ✅ "Grant Legendary" → toast → /library 看到 +1 张 legendary
14. ✅ "Break Streak" → dashboard 出现红色复活横幅 "1 天前"
15. ✅ 点"复活" → toast "已复活到 5 天"（10/2）→ 横幅消失 → ❄️ 出现在 XP 数旁
16. ✅ "Reset Onboarding" → 跳回 /onboarding step 1
17. ✅ 关 tab 重开 → DEV chip 消失（sessionStorage 失效）
18. ✅ 单测 5+5+4+3 个 case 全 green

---

## 8. i18n 占位 keys

`src/lib/i18n.ts` 加约 45 个 key × 2 lang。命名空间：

```ts
// onboarding
'onboarding.step1.title': '准备好了吗？' / 'Ready?'
'onboarding.step1.subtitle': '练得越久，奖励越值得肝' / 'The longer you train, the better the loot'
'onboarding.step1.cta': '开始' / 'Start'
'onboarding.step2.title': '你想从哪些运动开始？' / 'Which sports do you want to start with?'
'onboarding.step2.cta_disabled': '请选择 1-3 项' / 'Pick 1-3'
'onboarding.step2.cta': '继续' / 'Continue'
'onboarding.step2.selected': '已选 {n}/3' / 'Selected {n}/3'
'onboarding.step3.title': '提交你的第 1 次运动' / 'Submit your first workout'
'onboarding.step3.duration': '时长（分钟）' / 'Duration (min)'
'onboarding.step3.intensity.light': '轻' / 'Light'
'onboarding.step3.intensity.medium': '中' / 'Medium'
'onboarding.step3.intensity.high': '强' / 'High'
'onboarding.step3.cta': '提交' / 'Submit'
'onboarding.step4.title': '你的开局卡组' / 'Your starter deck'
'onboarding.step4.cta': '继续' / 'Continue'
'onboarding.step4.error_retry': '网络错误，重试' / 'Network error, retry'
'onboarding.step5.cta': '完成' / 'Done'
'onboarding.step5.tip1': '这是你的连续打卡天数（streak）' / 'Your streak day count'
'onboarding.step5.tip2': '断了就要复活，连了越久奖励越好' / 'Break it to revive — the longer the better'
'onboarding.step5.tip3': '去 Arena 用卡组挑战' / 'Battle in Arena with your deck'

// revive
'revive.banner.title': 'STREAK 已断 · {days} 天前' / 'STREAK BROKEN · {days}d ago'
'revive.banner.subtitle': '复活恢复到 {n} 天 · 代价 50% XP 冻结 24h' / 'Revive to {n}d · 50% XP frozen 24h'
'revive.cta': '复活' / 'Revive'
'revive.success.toast': '已复活到 {n} 天' / 'Revived to {n}d'
'revive.error.already_revived': '已经复活过 · 24h 后再试' / 'Already revived · retry in 24h'
'revive.error.window_closed': '复活窗口已关闭' / 'Revive window closed'
'revive.error.generic': '复活失败：{msg}' / 'Revive failed: {msg}'

// freeze
'freeze.tooltip': 'XP 冻结至 {time}' / 'XP frozen until {time}'

// protect
'protect.consumed.toast': '保护卡续命 · 剩余 {n}' / 'Protect card consumed · {n} left'
'protect.granted.toast': '+1 保护卡 · 库存 {n}/3' / '+1 Protect card · stock {n}/3'

// dev
'dev.chip': 'DEV'
'dev.title': 'DEV MODE · 测评菜单' / 'DEV MODE · Reviewer Menu'
'dev.actions.set_streak': '设 Streak' / 'Set Streak'
'dev.actions.grant_legendary': '抽 1 张传说' / 'Grant Legendary'
'dev.actions.level_up': '升 1 级' / 'Level Up'
'dev.actions.break_streak': '断 Streak' / 'Break Streak'
'dev.actions.grant_protect': '+1 保护卡' / '+1 Protect Card'
'dev.actions.reset_onboarding': '重看引导' / 'Reset Onboarding'
'dev.actions.reset_progress': '重置全部' / 'Reset All'
'dev.actions.exit': '退出 DEV 模式' / 'Exit DEV'
'dev.error.unknown_action': '未知 action: {action}' / 'Unknown action: {action}'
```

---

## 9. v1 不做（明确 defer）

- ⏭️ 真实 SVG 箭头 overlay（先 3 行文字 + 圆点）
- ⏭️ "重看引导"在普通用户菜单暴露（只在 Dev 里）
- ⏭️ 保护卡补发 N 张（last_grant 14 天前不补发 2 张，简化为只补 1）
- ⏭️ 复活二次确认 modal（点直接生效）
- ⏭️ Wow #2 / Wow #3 满屏特效（已在 Day 4/5 隐式触发）
- ⏭️ Onboarding 数据跨设备同步（v1 是 anon，本来就不跨设备）

---

## 10. 风险 + Mitigations

| 风险 | Mitigation |
|---|---|
| Step 5 overlay 3 个圆点定位 hardcode 像素值，dashboard 改动后偏移 | 用 useRef 测量目标元素，运行时定位 |
| Step 2 选 3 项 → exploration_buffs jsonb 写入失败 | step 4 调 grant_onboarding_pack 时一次性传入；失败 retry × 2 + toast |
| Dev mode 评审误清除数据，演示中断 | Reset Progress 加二次确认 modal（这一个 action 单独处理） |
| sessionStorage 关 tab 失效，评审无意识 | README 写明"评审菜单：URL 加 ?dev=1 即可" |
| OnboardingGate 在 useCurrentUser 加载中闪一帧 dashboard | isLoading 时返回 children（让 BootScreen 处理），不立即 redirect |
| dev_dispatch 'reset_progress' 删完 user_cards / workouts 但 deck 表(deck_card)仍引用 | reset_progress 也要 delete from decks where user_id |

---

## 11. Migration 文件

- `supabase/migrations/20260510000011_day6_streak_protect_revive.sql`
  - alter users 加 3 字段
  - replace submit_workout (含 4 个新行为)
  - create revive_streak / grant_onboarding_pack / dev_dispatch
  - grant execute to authenticated

后续可能根据测试发现的 bug 加 fix migrations（同 Day 5 节奏：每个 fix 一个 migration）。

---

## 12. 文件结构 (新增 + 修改)

新增：
```
supabase/migrations/20260510000011_day6_streak_protect_revive.sql
src/store/useDevStore.ts
src/components/OnboardingGate.tsx
src/components/ReviveBanner.tsx
src/components/DevDrawer.tsx
src/components/DashboardTourOverlay.tsx
src/components/cards/CardReveal3.tsx       (从 Loot 抽出，被 Onboarding 复用)
src/components/onboarding/Step1Welcome.tsx
src/components/onboarding/Step2Sports.tsx
src/components/onboarding/Step3MockWorkout.tsx
src/components/onboarding/Step4LootReveal.tsx
src/components/onboarding/ProgressDots.tsx
src/api/onboarding.ts
src/api/revive.ts
src/api/dev.ts
src/lib/streak/protect.ts
src/lib/streak/revive.ts
src/lib/streak/grant.ts
src/lib/streak/__tests__/protect.test.ts
src/lib/streak/__tests__/revive.test.ts
src/lib/streak/__tests__/grant.test.ts
src/components/__tests__/OnboardingGate.test.tsx
```

修改：
```
src/App.tsx               (加 OnboardingGate + DevDrawer + dev keyboard handler)
src/pages/Onboarding.tsx  (完全重写)
src/pages/Dashboard.tsx   (加 ReviveBanner + freeze ❄️ icon + DashboardTourOverlay)
src/pages/Loot.tsx        (改用 CardReveal3，小重构)
src/components/Sidebar.tsx (条件加 DEV chip)
src/lib/i18n.ts           (加 ~45 keys × 2 lang)
src/api/users.ts          (extends type with onboarded_at/freeze_xp_until/last_protect_grant_at)
```

预计 ~28 文件 / ~1400 行净新增。

---

## 13. 自审清单

- [x] **占位扫描:** 无 TBD / TODO，每个 RPC / 组件都有完整 sketch
- [x] **内部一致:** Step 4 调 grant_onboarding_pack(buffs) — Step 2 把 buffs 留 client，Step 4 调 RPC 一次性传 — Step 5 完成只跳路由（已统一）
- [x] **scope 检查:** Day 6 单 plan 可承载，4 块功能耦合度高（onboarding 调 grant，dev 调 reset_onboarding，复活依赖 freeze）
- [x] **歧义检查:** "Wow #1 触发"明确为 step 4 中央 epic 金光（不是 toast / 不是全屏）；"复活恢复 50%"明确为 floor(prev_streak / 2)
- [x] **依赖检查:** schema 字段 `onboarded_at` 引用 `users.exploration_buffs` jsonb（Day 1 schema 已有）— 不冲突
- [x] **测评目标对齐:** Wow #1 = step 4 epic + 金光; Dev menu 让评审手动 break/revive 看反馈; 10 分钟流程 = onboarding 90s + dashboard 60s + arena 8 turns 5min ≈ 7 min ✓
