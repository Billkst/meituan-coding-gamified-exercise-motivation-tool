# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-05-12

**Clash v2 — full battlefield rewrite, AI-generated sprites, onboarding v2.**

### Added

- **Pixi.js v8 renderer.** New `src/clash/render/PixiBattlefield.tsx` replaces
  the v0.1 DOM battlefield. Sprite reconciliation via `Map<unitId, Container>`,
  30 Hz mutating engine state, FPS fallback that caps at 30 fps when sustained
  below 45 fps for 60 frames. Lazy-loaded as a 97 KB gzip chunk, separated from
  the 163 KB gzip main bundle.
- **AI sprite pipeline.** `scripts/gen-sprites.ts` (gpt-image-2 via bytecat),
  `scripts/qa-sprites.ts` (sharp-based content QA), `scripts/optimize-sprites.ts`
  (WebP atlas pack with auto-chromakey for AI-painted checker backgrounds).
  38 sprites generated and packed into 12 atlases (2.0 MB total payload).
- **Procedural tweens.** `spriteTween.ts` — idle bob, walk swing, attack
  thrust, death fade, spawn rise. Applied to each unit body Container per tick
  so the hp bar + side ring stay anchored.
- **VFX layer.** Hit particles, projectile flight (arrows + fireball
  variants), tower destruction with screen shake (`.clash-shake` CSS
  keyframes), deploy smoke. Single dispatcher in `effectManager.ts` walks
  `state.log` forward of last-seen tick and routes per `LogEntry.t`.
- **Procedural audio.** `src/clash/audio/index.ts` synthesizes 4 voices
  (unit_deploy, tower_destroy, victory, defeat) via Web Audio API
  OscillatorNode + BufferSource noise. No mp3 files vendored. Default-muted
  with localStorage persistence; AudioContext resumed on first user gesture.
- **Onboarding v2.** 4-step narrative: welcome / 30 s mock workout with coin
  shower / 6-card chest reveal with CSS 3D flip / tutorial battle where the
  player must destroy 1 princess tower to graduate. `pulse.onboarding.completed_v2`
  is set only on tutorial completion.
- **Tutorial engine.** `src/clash/engine/tutorial.ts` — replaces adversarial
  AI with a single-goblin spawner that goes silent after tick 30. ClashMatch
  reads `?tutorial=1`, swaps the policy, hides finalize RPC, and watches for
  `enemy_left` HP=0 to navigate to TutorialResult.
- **Inactivity hint ladder.** Tutorial mode shows escalating hints at 30 s /
  60 s / 90 s of no-deploy idle, with a skip button at the third tier.
- **TutorialResult page.** Standalone, not a fork of ClashResult. No gold /
  chest UI. CTA back to /clash.
- **/reset route.** `/reset?force=1` wipes `pulse.*` localStorage and calls
  `dev_reset_user` RPC (gracefully degrades when missing). Bare `/reset`
  shows a confirmation page.
- **Migration 28.** `cr_grant_starter_pack` + `dev_reset_user` SECURITY
  DEFINER RPCs (`supabase/migrations/20260512000028_starter_pack_and_reset.sql`).
- **Pathfinding fix.** Two-phase nextWaypoint algorithm so ground units
  push through the river instead of stalling at the bridge — root cause was
  the old `crossingNorthbound` predicate returning the same point. Locked
  with 8 new TDD regression tests in `pathfinding.test.ts` (20 total).
- **Playwright e2e suite.** 6 specs covering smoke, match pregame, onboarding
  flow, tutorial-result, and the judge 5-minute path. Runs in GitHub Actions
  with stub Supabase env vars.
- **6 product-thinking artifacts.** `docs/product-thinking/` —
  fitness↔gold mapping, habit loop, PULSE-vs-Keep positioning, intentional
  fakes inventory, Clash Royale clone rationale, Pixi-vs-DOM decision write-up.
  Plus `asset-prompt-log.md` documenting the sprite pipeline.
- **Palette consolidation.** `src/clash/render/palette.ts` is the single
  source of truth for Pixi-format colors used by the canvas renderer. Tokens
  mirror DESIGN.md.

### Changed

- **Sidebar.** 12 nav items → 4 (home / workout / collection / dashboard).
- **Routes.** `/clash/cards` and `/clash/deck` collapse into
  `/clash/collection?tab=...`.
- **Onboarding.** Rewired from v1 5-step (preference collection) to v2
  4-step (product loop demonstration).
- **README.** Rewritten for v0.2 with the 5-minute judge path front-loaded
  and links to all 7 product-thinking docs.
- **OnboardingGate.** Whitelist for `/reset`, `/clash/tutorial-result`, and
  `/clash/match?tutorial=1` so judges can always reach those.

### Removed

- 11 v0.1 pages: Arena, ArenaBattle, ArenaResult, Loot, CardLibrary,
  DeckBuilder, Achievements, Friends, Leaderboard, Sports, Stats.
- v0.1 DOM battlefield + Unit + Tower + DamageNumber components.
- v0.1 onboarding Step 1–4 + ProgressDots.
- `src/lib/{battle,achievements,quests,cardArt,sportIcon}` modules.
- `src/store/useBattleStore.ts`.
- Roughly 5,500 net lines deleted across Day 21.

### Fixed

- Bridge crossing P0 bug (units stalled at `(bridgeX, 14.5)`).
- CI flakes from missing `VITE_SUPABASE_*` env vars in stub mode (workflow
  injects stubs at job level).
- Playwright body-visibility false-negatives on Ubuntu CI (Onboarding stub
  used only fixed-position children; smoke spec now checks `#root` +
  non-empty innerText).

### Not in scope

- PvP between human players (engine supports it; no signalling layer).
- Real fitness tracking (GPS / HRV / Apple Health) — see Doc 01 + 04.
- Achievements / Friends / Leaderboard — removed in Day 21, intentional.
- Multi-deck management, voice-over narration, server-authoritative
  validation.

## [0.1.0] — 2026-05-04

Initial 20-day build. Streak + Loot + Arena (DOM, attribute-clash combat) +
Achievements + Friends + Leaderboard + Stats + 5-step preference onboarding.
Most of this surface was removed in v0.2; see commit history for details.
