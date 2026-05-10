# Day 10 Plan — 评审就绪化 + 打磨

**Spec:** [`../specs/2026-05-10-day10-review-readiness-design.md`](../specs/2026-05-10-day10-review-readiness-design.md)

## 实施顺序

按"小步可回退"原则，每块独立 commit。

---

### Step 1 — Mobile 响应式（先做最大块）

**为什么先做：** Tour 步骤要适配 mobile drawer，所以 sidebar 改完再做 tour。

**改动：**

1. `src/components/Sidebar.tsx`
   - 加 `isMobileOpen` 本地 state
   - 加汉堡按钮（移动端显示）：在最上方 `fixed top-4 left-4 z-30 md:hidden`
   - aside 容器：移动端默认 `-translate-x-full`，open 时 `translate-x-0`
   - 加移动端 backdrop：`<div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={close} />`（仅 isMobileOpen 时渲染）
   - NavLink onClick 自动 close
   - z-index：backdrop z-20，sidebar z-30，DevDrawer 已经是高层（保留）

2. `src/App.tsx`
   - main: `flex-1 ml-[240px]` → `flex-1 md:ml-[240px]`

3. 各 page 顶层 padding：
   - 大批 `px-8 py-12` → `px-4 md:px-8 py-8 md:py-12`
   - 用 grep 找出所有 page 文件批量改

4. Stats 栅格：
   - `StatsSummary.tsx` grid 改成 `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`
   - `XpTrendChart.tsx` SVG 加 `viewBox="0 0 800 200"` 删 width/height 写死

**验收：**
- 桌面 sidebar 正常
- 375px 视口：sidebar 默认隐藏，汉堡按钮显示，点击 → drawer in，选 nav → 跳页 + drawer close

**Commit:**
```
feat(day10): mobile responsive — sidebar drawer + page padding
```

---

### Step 2 — Welcome Tour

**改动：**

1. 新建 `src/components/WelcomeTour.tsx`
   - props 无
   - state：`currentStep`（0-5），`isVisible`
   - useEffect on mount：检查 `localStorage.getItem('pulse.tour.seen')`，不存在则 `setIsVisible(true)`
   - useEffect on `currentStep` change：用 `document.querySelector('[data-tour="..."]')` 找锚点，计算 BoundingClientRect → 设置 highlight + tooltip 位置
   - 步骤数据：6 个 `{ key, contentKey, anchorSelector }`，文案走 i18n
   - 渲染：
     - backdrop（半透明）
     - highlight ring（用 box-shadow 反向 spread + clip-path）
     - tooltip 卡片（位置贴 anchor 下方 / 右侧）
     - 上一步 / 下一步 / 跳过 按钮
     - 进度 dots（6 个）
   - 走完或跳过：`localStorage.setItem('pulse.tour.seen', '1')`，setIsVisible(false)

2. `src/components/Sidebar.tsx`
   - NAV 数组每条加 `data-tour` attr：sidebar / workout / loot / arena / leaderboard / achievements
   - 实际写法：在 NavLink 上加 `data-tour={item.tourKey}`，类型扩 `tourKey?: string`

3. `src/pages/Dashboard.tsx`
   - top render `<WelcomeTour />`（自己负责 visibility 判断）

4. i18n keys：在 `src/lib/i18n.ts` 加 `tour.step1`...`tour.step6` + `tour.next` / `tour.prev` / `tour.skip` / `tour.done` / `tour.progress`

**移动端处理：**
- mobile sidebar 是隐藏的，所以 step 1 文案改成"主导航在左上角的汉堡按钮"，highlight 改为汉堡按钮的 `data-tour="hamburger"`
- 检测 `window.innerWidth < 768` → 用 mobile-specific anchor 数组
- step 2-6 在 mobile 都 anchor 到汉堡按钮（让用户自己点开看）→ 简化处理：不强求 highlight 切换 nav，就 anchor 到汉堡 + 文案讲清楚

**验收：**
- 清 localStorage → 注册 → 跳到 dashboard → tour 自动出来
- 走完或跳过 → 刷新 → 不再触发
- mobile 视口下 tour 也能用

**Commit:**
```
feat(day10): welcome tour — 6-step first-visit guide
```

---

### Step 3 — Backlog 打磨

**改动：**

1. `src/lib/i18n.ts`
   - `arena.lobby.your_segment` zh: "段位" → "赛季分"
   - `arena.lobby.your_segment` en: "Segment" → "Season Score"
   - 复查 `achievements.category.*` keys 完整性

2. `src/lib/i18n.ts` lang 持久化
   - 当前 `useTranslation` 的 lang 来自 useState 默认 'zh'
   - 改为：初始读 `localStorage.getItem('pulse.lang') ?? 'zh'`
   - toggleLang 时 `localStorage.setItem('pulse.lang', newLang)`

3. `src/pages/DeckBuilder.tsx`
   - 在 title row 下加：当 `myCards.length < 8` 时显示
     ```
     <div className="bg-rarity-rare/20 border-l-2 border-rarity-rare px-4 py-3 mb-6 font-mono text-sm uppercase tracking-widest">
       {t('deck.cards_insufficient', { have: myCards.length })}
     </div>
     ```
   - i18n key `deck.cards_insufficient` zh: "你只有 {have} 张卡，至少需要 8 张才能保存。先去 [抽卡] 攒够。" en 类似

**验收：**
- Arena 页"赛季分"
- Deck 卡少时 hint 出现，卡 ≥ 8 时 hint 消失
- 切 EN → 刷新 → 还是 EN

**Commit:**
```
chore(day10): polish — segment label + deck hint + lang persistence
```

---

### Step 4 — README + 截图

**改动：**

1. 启 dev server，浏览器访问，截 4 张图：
   - dashboard（含 streak / quests / achievements toast）
   - loot（抽卡过程或结果）
   - arena（lobby + 8 关卡阶梯）
   - leaderboard（self card + entries）
   存到 `docs/screenshots/{dashboard,loot,arena,leaderboard}.png`

2. `README.md` 全新写，按 spec 给的结构。

**验收：**
- README 在 GitHub 渲染正常（截图能加载）
- 评审点链接 → 5 分钟读完 → 知道这是什么 + 怎么用

**Commit:**
```
docs(day10): README + screenshots
```

---

### Step 5 — 验收

```bash
bunx tsc --noEmit
bun run test
bun run build
```

启 dev server 浏览器 smoke：
- 桌面 → 5 page 钻一遍 → 0 console error
- 改 viewport 375 → sidebar 折叠 → 汉堡 → drawer
- 清 localStorage → 注册 → tour
- 切 EN → 刷新

---

## 涉及文件清单

| 文件 | 改动 |
|------|------|
| `src/components/Sidebar.tsx` | mobile drawer + tour anchors |
| `src/App.tsx` | main md:ml-[240px] |
| `src/pages/*.tsx` (10 个) | px-4 md:px-8 |
| `src/components/stats/StatsSummary.tsx` | grid breakpoints |
| `src/components/stats/XpTrendChart.tsx` | viewBox |
| `src/components/WelcomeTour.tsx` | 新组件 |
| `src/pages/Dashboard.tsx` | render WelcomeTour |
| `src/pages/DeckBuilder.tsx` | cards_insufficient hint |
| `src/lib/i18n.ts` | 文案 + 持久化 + tour keys |
| `README.md` | 全新写 |
| `docs/screenshots/*.png` | 4 张图 |

总计 ≈ 15 文件。

## 不动的文件

- 任何 supabase/migrations/* — Day 10 无 schema 改动
- 任何 src/api/* — 无 RPC 改动
- 任何 store/* — 无新 store
- 任何 test 文件 — 现有 57 test 应该全 green，新组件不强求 test（Tour / Sidebar 是 UI-heavy）
