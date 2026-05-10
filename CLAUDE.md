# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

美团编程游戏化练习激励工具 (PULSE — Meituan Coding Gamified Exercise Motivation Tool).

测评作业项目（不是上线产品）。评判维度 = 产品思考完整度 + 评审在线亲自体验。

## Stack

- **Frontend:** Vite 5 + React 18 + TypeScript (strict) + Tailwind v3
- **State:** Zustand (`src/store/*`) + @tanstack/react-query
- **Routing:** react-router-dom v6
- **Backend:** Supabase (Postgres + anon auth + RPC)，schema 在 `supabase/migrations/`
- **Tests:** Vitest + @testing-library/react + jsdom（命令：`bun run test`）
- **Build:** `bun run build`，类型检查：`bunx tsc --noEmit`
- **Package mgr:** Bun

## 文件组织

```
src/
├── pages/            # 路由级页面（Dashboard、Onboarding、Loot、Arena 等）
├── components/       # 复用 UI（Sidebar、ReviveBanner、DevDrawer、cards/、onboarding/、battle/、deck/）
├── api/              # Supabase RPC + React Query hook（每个 RPC 一个文件）
├── store/            # Zustand stores（useAuthStore、useDevStore）
├── lib/              # 纯函数（i18n、supabase client、streak/* 助手）
└── types/db.ts       # 数据库行类型（UserRow、CardRow、SportRow…）

supabase/migrations/  # 累积式 schema migration（编号递增）
```

每天交付物：`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` + `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`。

## 操作 gotchas（Day 1-7 踩出来的坑）

### Supabase migration push（WSL2 IPv4 问题）
直连 `db.<ref>.supabase.co` 走 IPv6，WSL2 拒接。**唯一稳定的姿势**：用 raw 密码 prompt → URL-encode → 嵌进完整 Session Pooler URL，整串当 `--db-url`：
```bash
read -r -s -p "DB password: " SUPABASE_DB_PASSWORD
echo
export SUPABASE_DB_PASSWORD

ENC_PASS=$(python3 - <<'PY'
import os
from urllib.parse import quote
print(quote(os.environ["SUPABASE_DB_PASSWORD"], safe=""))
PY
)

SUPABASE_DB_URL="postgresql://postgres.hahxjtddwnqpklgftsgj:${ENC_PASS}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

bunx supabase db push --include-all --db-url "$SUPABASE_DB_URL"
```

**踩过的坑（Day 7 验证）：** `SUPABASE_DB_PASSWORD='<encoded>' --db-url "$(cat supabase/.temp/pooler-url)"` 这种"env 给（已 encode 或 raw）密码 + URL 不带密码"的混合姿势 SASL 都会拒——`supabase` CLI 不会用 env 的 password 去填空 pooler URL 中缺失的密码段。**密码必须直接嵌进 db-url** 里（且嵌进去时一定要 URL-encode）。`supabase/.temp/pooler-url` 只是 host/user 模板参考，别直接当 `--db-url` 用。

### Toast / 全局通知
项目**没有 toast lib**（不要 import sonner / react-hot-toast）。用 inline state 模式：
```tsx
const [flash, setFlash] = useState<{kind, msg} | null>(null)
useEffect(() => { if (flash) setTimeout(() => setFlash(null), 5000) }, [flash])
```
参考 `DevDrawer.tsx` / `ReviveBanner.tsx`。

### 评审 / Dev 模式
URL 加 `?dev=1` 激活 dev mode（sessionStorage 持久化，关 tab 失效）。Sidebar 显示红色 DEV chip，点击或 `Cmd/Ctrl+Shift+D` 打开 drawer。Drawer 走 `dev_dispatch` RPC，7 个 action：set_streak / grant_legendary / level_up / break_streak / grant_protect / reset_onboarding / reset_progress。

### Supabase RPC + TypeScript
`Database` 类型不导出 `Functions`，所以 `supabase.rpc(name, args)` 推断 args 为 undefined。复用既有模式：
```ts
const { data, error } = await supabase.rpc('rpc_name' as never, { ... } as never)
```
参考 `src/api/submitWorkout.ts`。

### main 分支直接开发
Day 1-N 都在 `main` 上累积式提交（小步、可回退）。新功能不开 feature branch。Brainstorming → spec → plan → subagent-driven implement 流程见 `docs/superpowers/`。

## Superpowers Skills

This repo uses the [superpowers](https://github.com/obra/superpowers) skills framework. All skill definitions are symlinked in `.claude/skills/`. When working on features, always invoke the relevant skill (brainstorming, test-driven-development, systematic-debugging, etc.) before writing code.

## 0. Response Language

**Always respond in Simplified Chinese.**

- All explanations, plans, clarifying questions, summaries, and final answers must be written in Simplified Chinese.
- Keep code, commands, file paths, API names, error messages, and quoted source text in their original language when necessary.
- If the user explicitly requests another language, follow the user's request for that response only.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Design System

Always read `DESIGN.md` (in repo root) before making any visual or UI decisions. All font choices, colors, spacing, and aesthetic direction are defined there. Do not deviate without explicit user approval. In QA mode, flag any code that doesn't match DESIGN.md.

Token preview reference (live fonts + glow + icons): `~/.gstack/projects/Billkst-meituan-coding-gamified-exercise-motivation-tool/designs/design-tokens-preview-20260509.html`

---

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

