# 06 — Pixi vs DOM: the renderer decision

**Question:** v0.1 rendered the Clash battlefield with absolute-positioned
divs and Tailwind. v0.2 swapped to a Pixi.js v8 canvas. Why move, and why
specifically Pixi?

## What broke in the v0.1 DOM renderer

The v0.1 renderer rendered each unit, tower, and damage-number as a React
component with absolute positioning. On a 30 Hz engine tick the entire
battlefield re-rendered through React's reconciler. Symptoms by mid-game
with ~30 units on the field:

- React reconciliation became the bottleneck on Chromebooks and 2018-era
  Android browsers
- Damage numbers visibly stuttered, breaking the "live combat" illusion
- Bridge-crossing pathfinding (which is correct in the engine) *looked*
  broken because position updates landed unevenly across frames
- The DOM also made particle-style effects nearly impossible — 30 hit
  particles × 60 fps = 1800 React reconciler cycles/second, which is
  silly

Worth noting that none of this is a React bug. React is well-suited to UI
that updates at human-perceptual rates (clicks, form input). It's
poorly-suited to a 60 Hz simulation surface. We were misusing it.

## The options we considered

| Option | What it is | Why we rejected (or accepted) |
|--------|-----------|-------------------------------|
| **Keep DOM, optimize** | Memoization, virtualization, CSS transforms | The reconciler cost is fundamental; we'd be fighting the framework. Diminishing returns. |
| **Plain Canvas2D** | Browser `<canvas>` + raw 2D API | Works, but writing sprite batching + texture management by hand is busywork. Re-implementing a 1/10 version of Pixi. |
| **Pixi.js v8** | Open-source 2D WebGL renderer with sprite batching, texture atlases, ticker, particle containers built-in | Selected. Industry-standard for browser-based 2D games. |
| **Phaser.js** | Pixi + game-engine helpers (physics, tweens, scenes) | Overkill. We already have a working engine in `src/clash/engine/`. We need a renderer, not a game framework. |
| **Three.js** | 3D first | Wrong dimension. 2D-on-Three.js is awkward; sprite + 2D camera + ortho projection adds noise. |
| **Native WebGL** | Hand-rolled shaders | Same "writing 1/10 version of Pixi" trap, one level deeper. |

Pixi v8 won on three axes: industry maturity (used in shipped games),
v8's recent API cleanup (`graphics.rect().fill()` chainable instead of
v7's begin/end), and the lazy chunk story (it splits cleanly out of the
main bundle).

## The architectural shape we settled on

```
useClashEngine (React)
  └── stateRef (mutable MatchState, mutated each tick)
        │
        ▼ passed as prop on every React re-render
PixiBattlefield (React lazy chunk)
  ├── stateRef.current synced into a Pixi-local ref
  ├── PIXI.Application + canvas init (once per mount)
  ├── Sprite reconciliation: Map<unitId, PIXI.Container>
  │     - new id  → add sprite to stage
  │     - same id → update transform from stateRef.current
  │     - missing → destroy sprite + remove from map
  └── PIXI.Ticker drives the per-frame update at native frame rate
```

The key insight: React and Pixi own different things and don't compete for
ownership.

- **React owns** the page chrome (top bar, hand, elixir bar, modals).
  These update at human-perceptual rates — perfect for React.
- **Pixi owns** the battlefield canvas. The Pixi ticker runs at native
  frame rate, reads from a mutable `stateRef`, and never asks React to
  re-render the canvas.
- **The bridge** is a single React prop passing a reference to the
  mutable `MatchState`. Identity stays stable across renders (the engine
  mutates in place), so dependency tracking in React works correctly
  while letting Pixi read fresh values every frame.

## What we gave up

- **Single-codebase rendering.** v0.1's render was 100% React. v0.2 has
  two parallel renderers. New contributors have to know which side
  handles what. The trade-off is mostly negative; we paid the complexity
  for the perf win.
- **Server-rendering compatibility.** Pixi requires a browser canvas.
  This isn't a Next.js app so we don't care, but if PULSE ever migrates
  to a Next.js-style SSR stack, the battlefield won't render on the
  server. Easy to gate (`if (typeof window)`), still a real constraint.
- **Direct CSS interaction.** A hover state on a unit can't be a CSS
  pseudo-class anymore; it has to be Pixi event handling, then propagate
  back to React if React needs to react. We've avoided this by keeping
  unit interactions canvas-internal.

## How we measured the win

Before/after on a 2018 Chromebook in Chrome, with 30 units on field:

| Metric | v0.1 DOM | v0.2 Pixi |
|--------|---------|-----------|
| FPS (mid-game) | 22–28 | 58–60 |
| React reconciliations per second | ~60 | ~2 (chrome only) |
| Time-to-first-deploy after match start | 600 ms | 250 ms |

The chunk-split keeps the cost honest: the Pixi-using lazy chunk only
loads when the user actually enters `/clash/match`. Dashboard / home /
collection / workout never download Pixi.

```
main bundle:                       ~163 KB gzip
PixiBattlefield lazy chunk:        ~97 KB gzip
Pixi sub-chunks (WebGL/Canvas/...): split per renderer
sprite atlases (12 files):          2.0 MB lazy
```

The user pays 0 KB for Pixi until they actually try to fight. That's
exactly the lazy bundling contract React.lazy is for; we just had to
ensure no top-level import in the main entry pulls `pixi.js` in
transitively, which means `useClashAssets` and the effect modules all
live inside the lazy chunk's import tree.

## What we'd do differently next time

- **Reach for Pixi earlier.** Spending Day 1–15 on the DOM renderer was
  effort that didn't compound — most of it was thrown away in Day 22.
  The lesson is that simulation-frequency rendering doesn't belong in
  the React tree; the longer you wait to admit it, the more code you
  rewrite.
- **Decouple coords helper from `useClashAssets` from `effectManager`
  from `spriteTween` earlier.** Today they're separate modules; v0.1
  was a single 220-line file. The split lets each piece be tested
  independently (see `src/clash/render/__tests__/coords.test.ts`) and
  makes the Pixi-touching surface explicit when reviewing what's safe
  to import from where.
