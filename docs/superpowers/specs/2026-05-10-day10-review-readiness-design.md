# Day 10 — 评审就绪化 + 打磨

**日期：** 2026-05-10
**目标用户：** 测评人（5 分钟内打开链接、看懂产品、跑完核心循环、写评分）

## 1. 背景

Day 1-9 把 PULSE 的核心循环全打通：
- 9 个主 page、17 个 migration、57 个 unit test
- 完整 retention loop：onboarding → workout/抽卡/streak → arena → deck → achievements/quests → stats → leaderboard
- 8 名 demo 用户的 leaderboard 数据已 seed

但**评审上手成本仍然高**：
1. README 是空的，评审打开 GitHub 不知道这是什么
2. 桌面端 hardcode `w-[240px]` sidebar + `ml-[240px]` main，**手机点开链接直接错位**（评审多半在通勤路上看）
3. 第一次注册完跳到 dashboard 后没有引导，评审可能漏掉 arena / achievements 这些深层 page
4. 还有 3 处 backlog（Arena 段位标签、Deck 空槽 UX、Lang toggle 持久化）会影响第一印象

Day 10 把这 4 件事**一天内**收口，让评审任何设备打开都能 5 分钟跑完整循环。

## 2. 4 个交付物

### A. README.md（评审入口文档）

放仓库根，评审第一眼看的东西。

**结构（按评分价值排序）：**

```markdown
# PULSE — 美团编程游戏化运动激励工具

> 把"今天必须练"从负担变成"今天能抽卡 + 上分"。

## 体验入口
- 在线 demo: <link>（评审请点这个）
- 评审快捷入口: <link>?dev=1（开发者抽屉激活）

## 60 秒看懂
- 用户提交一次运动 → 获得 XP + 抽卡 + streak +1
- 攒 8 张主卡组 → 进 Arena 打 PVE → 拿 season_score 上 leaderboard
- 18 个成就 + 9 类每日任务 → 二级动力回路

## 核心循环（图）
[ASCII / mermaid]

## 5 大机制
1. **Streak（连续打卡）** — 断签可消耗 protect 卡或 24h 内 revive
2. **Loot（抽卡）** — 4 rarity，按运动类型有 buff 加成
3. **Arena（PVE 对战）** — 8 关阶梯，需构筑 8 张卡组
4. **Achievements / Quests** — 静态 18 + 每日 3 + bonus
5. **Leaderboard** — week / month / all 三种 period

## 设计决策（亮点）
- 把"惩罚断签"重构成"投入感正反馈"（protect / revive 而非清零）
- 抽卡按 streak 等级浮动概率（前 7 天保底 1 epic）
- ⋯⋯（5 条）

## Stack
Vite 5 + React 18 + TS strict + Tailwind v3 + Supabase + Zustand + React Query

## 本地运行
```

**截图：** 4 张（dashboard / loot / arena / leaderboard），存 `docs/screenshots/`，README 内嵌引用。

**长度上限：** 评审 5 分钟读完 → 200-300 行（含图）。

---

### B. 移动端响应式

**核心痛点：** Sidebar `fixed left-0 w-[240px]` + main `ml-[240px]` 在小于 640px 屏幕导致：
- main 内容被挤到 240px 右侧但视口只有 375px，水平滚动
- Sidebar 永远占 64% 屏宽，没法看主内容

**改造方案（最小代价）：**

1. **Sidebar 改造：**
   - 桌面（≥ md 768px）：保持现在 240px fixed 抽屉
   - 移动（< md）：默认隐藏，左上角放汉堡按钮，点击 slide-in overlay
   - overlay 半透明 backdrop，点 backdrop 或选完 nav item 自动 close

2. **App.tsx main：**
   ```tsx
   <main className="flex-1 md:ml-[240px]">
   ```

3. **页面级 padding：**
   - 现在 `px-8 py-12` → 改 `px-4 md:px-8 py-8 md:py-12`

4. **Stats charts：**
   - StatsSummary 6 tile grid 默认 2 列 → md 变 3 列
   - XpTrend SVG 加 `viewBox` 让它自动 scale
   - SportBreakdown / CardCollection 已经是 div 不用改
   - ArenaPieChart 半圆 SVG 自带 viewBox，OK

5. **Sports 页 / Loot 页 / Arena 页 grid：**
   - 多数已经 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`，复查一遍

**断点：** Tailwind 默认 `sm 640 / md 768 / lg 1024`。我们用 `md` 作为 mobile/desktop 切分点（240px sidebar 在 768 以下展不开）。

---

### C. Welcome Tour（首次访问引导）

**触发条件：**
- `localStorage.getItem('pulse.tour.seen') === null`
- 用户**已 onboarded**（onboarded_at != null）
- 进 `/dashboard` 路由

**步骤（6 步，每步一个 highlight + 文案）：**

| # | Target | 文案 |
|---|--------|------|
| 1 | sidebar 整体 | "左边是主导航，10 个主功能" |
| 2 | nav workout | "提交今天的运动 → 拿 XP + 抽卡" |
| 3 | nav loot | "抽卡 5 秒动画，拿到的卡入库" |
| 4 | nav arena | "构筑 8 卡 deck → 打 PVE 拿 season_score" |
| 5 | nav leaderboard | "season_score 上榜对比 8 名 demo 用户" |
| 6 | nav achievements | "18 静态成就 + 9 每日任务" |

**UX：**
- 半透明 backdrop 盖整个页面
- 圈出当前 target（用 `clip-path` 或简单粗框）
- 卡片显示文案 + 「上一步 / 下一步 / 跳过」
- 步骤 1 的文案下方写"6 步约 30 秒"
- 走完或跳过 → 写 `localStorage.setItem('pulse.tour.seen', '1')`

**实现：**
- 单组件 `src/components/WelcomeTour.tsx`
- 在 `Dashboard.tsx` 顶部条件渲染
- 通过 `data-tour="<step-key>"` 给目标元素加锚点

**注意事项：**
- 移动端要 fallback：sidebar 隐藏在汉堡里，所以移动端 tour 改成 "主导航在左上角汉堡按钮"，点开汉堡再继续
- 保持简单：不做箭头连线、不做 step 切换动画，只做位置 highlight

---

### D. Backlog 打磨（4 个小项）

| # | 问题 | 修法 |
|---|------|------|
| 1 | Arena `arena.lobby.your_segment` 文案叫"段位"但显示 season_score（数字而非段位名）→ 误导 | i18n 改成"赛季分" / "Season Score" |
| 2 | Deck 0/8 时只有空槽，没告诉用户"卡不够先去抽" | 当 myCards.length < 8 时上方加红框 hint："至少需要 8 张卡才能保存（你有 N 张），先去 /loot 抽" |
| 3 | language toggle 切完刷新页面会回到默认 | useTranslation 加 localStorage 持久化（key: pulse.lang） |
| 4 | Achievements category 客户端 sort 已有，但 i18n category 标题在英文版可能错位 → 复查 | 看 i18n keys，补齐 |

---

## 3. 不做的事

- ❌ 不做 i18n 完整 EN 化（只补今天碰的 keys）
- ❌ 不做 PWA / installable
- ❌ 不做 Tour 的 mobile 重设计（mobile 只是 fallback 文案）
- ❌ 不重做 sidebar 设计（只加 collapse 行为）
- ❌ 不做 dark / light theme（已是 dark）
- ❌ 不动 backend（无 migration）

## 4. 验收

- [ ] `bunx tsc --noEmit` clean
- [ ] `bun run test` 全 pass
- [ ] `bun run build` success
- [ ] 桌面 1280×800 渲染正常（sidebar / main 各就各位）
- [ ] 移动 375×812 渲染正常（汉堡 → drawer → 选 nav → close）
- [ ] 清 localStorage → 注册 → onboarding → 落 dashboard → tour 自动跳出
- [ ] 跳过 tour 后刷新不再触发
- [ ] Arena 页面"赛季分"不是"段位"
- [ ] Deck 卡 < 8 张时 hint 出现
- [ ] 切 EN → 刷新 → 还是 EN

## 5. 风险

| 风险 | 缓解 |
|------|------|
| 移动端 Sidebar drawer 的 z-index 跟 DevDrawer 打架 | DevDrawer 用 z-50，新 mobile drawer 用 z-40，backdrop z-30 |
| Tour 锚点找不到（render race） | Tour 组件等到 sidebar mount 完再启动（用 useEffect + setTimeout 100ms 兜底） |
| README 截图引用路径在 GitHub 上断 | 用相对路径 `./docs/screenshots/x.png`，在仓库内放真图 |

## 6. 时间预算

| 交付物 | 估时 |
|--------|------|
| README + 截图 | 60 min |
| Mobile 响应式 | 90 min |
| Welcome Tour | 90 min |
| Backlog 打磨 | 30 min |
| 验收 + 修 bug | 30 min |
| **合计** | **5 小时** |

一天内可完成。

## 7. 后续 backlog

收口后未做的：
- 朋友 PVP（friends 系统 + battles vs_user）
- Profile / Settings 页面
- 推送提醒（service worker）
- 全 i18n EN 化
- Tour 的桌面/移动端 polish
