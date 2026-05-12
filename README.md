# PULSE — 美团编程游戏化运动激励工具

> 把"今天必须练"变成"今天能抽卡 + 上桌打 AI"。
> 一个把运动打卡转化为 Clash Royale 风格卡牌战斗的 web 工具。

**测评作业 · v0.2 · 26 天累积式开发 · 评判维度：产品思考完整度 + 评审在线亲自体验**

---

## 评审快速通道（5 分钟）

| 入口 | URL |
|---|---|
| 正式体验 | <https://meituan-coding.vercel.app> |
| **强制重置 + 重走完整流程** | <https://meituan-coding.vercel.app/reset?force=1> |
| 开发者抽屉 | <https://meituan-coding.vercel.app/?dev=1> |

**推荐 5 分钟路径**（在重置 URL 上走一遍）：

1. **/reset?force=1** → 清 localStorage + 后端用户状态 → 自动跳 `/onboarding`
2. **Onboarding 4 步**（< 90 秒）：
   - Step 1 — 一句话讲清产品（"把跑步变成抽卡"）
   - Step 2 — 30 秒模拟运动 → +200 金币飞屏（不要真起来跑）
   - Step 3 — 金色宝箱开启 → 6 张卡 CSS 3D 翻牌
   - Step 4 — 教学局自动开打，**你必须亲手推下一座 princess 塔**才能毕业
3. **ClashHome** → 看左上 streak / 中间对战按钮 / 右上 chests
4. **点对战** → ClashMatch 真打一局（拖卡到桥边部署，过桥 AI 对线）
5. **打完进 ClashResult** → 看 gold + chest 入账

整条路径无需注册，匿名 auth 自动签到。

---

## v0.2 的转折点（Day 21–26 重写）

v0.1（Day 1–20）把 Arena 做成 DOM 渲染的"属性对撞"——卡组总和 vs 卡组总和，一回合定胜负。视觉是 emoji + 占位 circle，机制单薄。

v0.2 把战斗层**整层换掉**：

| | v0.1 | v0.2 |
|---|---|---|
| 战斗引擎 | 属性对撞（一回合定输赢） | 30 Hz tick 实时模拟 |
| 渲染器 | DOM + Tailwind 绝对定位 | Pixi.js v8 WebGL canvas |
| 单位视觉 | emoji + 占位 circle | gpt-image-2 生成 12 卡 × ≤4 状态 |
| 角色动作 | 无 | idle bob / walk swing / attack thrust / death fade（前端 tween） |
| 特效 | 无 | 命中粒子 / 弓箭弹道 / 火球 / 塔倒塌震屏 / 部署烟雾 |
| 音效 | 无 | WebAudio API 程序化合成（不 vendor mp3） |
| Onboarding | 5 步全收集偏好 | 4 步叙事 + 教学局玩家亲手推塔 |
| Path 修复 | 单位卡在桥头 | TDD 修复 + 20 条 pathfinding 单测 |
| 主 bundle | ~340KB gzip | **163KB gzip**（Pixi 拆到 lazy chunk） |

v0.2 删了 11 个 v1 页面（Arena / Loot / Library / DeckBuilder / Achievements / Friends / Leaderboard / Sports / Stats / ArenaBattle / ArenaResult），−5564 行净删。Sidebar 12 项 nav 砍到 4 项。

---

## 产品思考 artifacts

这是评分的核心维度，放在 `docs/product-thinking/`：

| 文档 | 主题 |
|---|---|
| [01-fitness-gold-mapping.md](docs/product-thinking/01-fitness-gold-mapping.md) | 运动 → 金币的 mapping 决策（为什么是 flat 而非 duration 公式） |
| [02-habit-loop.md](docs/product-thinking/02-habit-loop.md) | Hooked 框架怎么落到 4 个 slot；为什么删 quests/leaderboard |
| [03-pulse-vs-keep.md](docs/product-thinking/03-pulse-vs-keep.md) | 用户分层：Keep 不服务的"motivation-poor"群体 + 给 Keep 让出的市场 |
| [04-intentional-fakes.md](docs/product-thinking/04-intentional-fakes.md) | 评审作业里**哪些是 theatre / 哪些是真**——诚实声明 |
| [05-clash-royale-clone-rationale.md](docs/product-thinking/05-clash-royale-clone-rationale.md) | 为什么选 CR 风格；IP 安全；refused 的其他游戏类型 |
| [06-pixi-vs-dom-decision.md](docs/product-thinking/06-pixi-vs-dom-decision.md) | 渲染器从 DOM 跳到 Pixi.js 的工程决策 |
| [asset-prompt-log.md](docs/product-thinking/asset-prompt-log.md) | 12 卡 × 3 状态共 38 张 AI sprite 的 prompt + IP 重命名 + 音效程序化合成的理由 |

---

## Stack

- **Frontend:** Vite 5 + React 18 + TypeScript (strict) + Tailwind v3
- **Renderer:** Pixi.js v8（lazy chunk，单独 ~97KB gzip）
- **State:** Zustand + @tanstack/react-query
- **Routing:** react-router-dom v6
- **Backend:** Supabase Postgres + RLS + plpgsql RPC + 匿名 auth
- **Audio:** Web Audio API 程序化合成（OscillatorNode + BufferSource）
- **Tests:** Vitest（112 单测）+ Playwright（5 e2e）
- **Package mgr:** Bun

---

## 本地运行

```bash
# 1. 装依赖
bun install

# 2. 填 Supabase env
cp .env.example .env.local
# 编辑 .env.local 加 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

# 3. 推 migrations（按 CLAUDE.md "Supabase migration push" 套路，WSL2 IPv6 坑见文档）

# 4. 起 dev server
bun run dev

# 5. 浏览器开 localhost:5173/reset?force=1 走完整流程
```

可选：

```bash
# 重新生成 AI sprites（需要 OPENAI_API_KEY in .env.local）
bun run scripts/gen-sprites.ts --anchor
bun run scripts/gen-sprites.ts
bun run scripts/qa-sprites.ts
bun run scripts/optimize-sprites.ts

# 跑测试
bun run test          # 112 unit
bun run test:e2e      # 5 e2e (chromium)
bunx tsc --noEmit     # 0 errors
bun run build         # production build
```

---

## Dev 模式（评审用）

URL 加 `?dev=1` 激活（sessionStorage 持久化）。Sidebar 显示红色 DEV chip，点击或 `Cmd/Ctrl+Shift+D` 打开抽屉。

7 个调试 action（v0.1 遗留，对 v0.2 部分仍可用）：

| Action | 用途 |
|---|---|
| `set_streak` | 直接设 streak 长度 |
| `grant_legendary` | 立即拿 1 张 legendary（v0.2 没 legendary tier，会 fallback 到 epic） |
| `level_up` | 升 1 级 |
| `break_streak` | 制造断签 |
| `grant_protect` | 加 1 张 protect 卡（v0.2 已删 protect 机制，no-op） |
| `reset_onboarding` | 清 onboarded_at 重看引导（推荐直接用 `/reset?force=1`） |
| `reset_progress` | 清成就 / 任务进度 |

---

## 仓库结构

```
src/
├── pages/                # /onboarding /workout /dashboard /reset
├── clash/                # 整个 Clash 子产品
│   ├── pages/            # ClashHome / ClashMatch / ClashResult / ClashCollection / TutorialResult
│   ├── components/       # Hand / ElixirBar / TimerBar / NextBestActionClash
│   ├── engine/           # tick / ai / tutorial / pathfinding / damage / targeting / unit
│   ├── render/           # PixiBattlefield + coords + spriteTween + effects/*
│   ├── audio/            # WebAudio 程序化合成
│   ├── hooks/            # useClashEngine / useClashAssets
│   └── api/              # Supabase RPC hook
├── components/           # 顶层 UI (Sidebar / OnboardingGate / SpotlightTour / DevDrawer / onboarding/v2/*)
├── store/                # Zustand (auth / dev)
└── lib/                  # 纯函数 (supabase client / i18n / streak helpers)

scripts/                  # gen-sprites / qa-sprites / optimize-sprites (Day 23 pipeline)
supabase/migrations/      # 28 个累积 migration
docs/superpowers/         # 每日 spec + plan
docs/product-thinking/    # 6 个评分核心文档 + asset-prompt-log
public/sprites/           # 12 atlas (.webp + .json) + 1 anchor PNG
```

---

## NOT in scope（v0.2 有意不做）

- ❌ **PvP（人 vs 人）** — 引擎支持，没建 signalling 层。v1 unlock 候选。
- ❌ **Real fitness tracking** — 一键打卡，不接 GPS / HRV / Apple Health。详见 [01-fitness-gold-mapping.md](docs/product-thinking/01-fitness-gold-mapping.md)
- ❌ **Achievement / Friends / Leaderboard** — v0.1 有，v0.2 删了。理由见 [02-habit-loop.md](docs/product-thinking/02-habit-loop.md)
- ❌ **Multi-deck management** — 只支持 1 个主卡组
- ❌ **Server-authoritative match validation** — client-trust。详见 [04-intentional-fakes.md](docs/product-thinking/04-intentional-fakes.md)
- ❌ **Card upgrade visual progression** / **Voice-over narration** / **zh-en 之外的语言**

---

## License

测评作业，未明确开源。AI 生成的 sprite 在 `public/sprites/` 下，prompt + 生成方法见 [asset-prompt-log.md](docs/product-thinking/asset-prompt-log.md)。
