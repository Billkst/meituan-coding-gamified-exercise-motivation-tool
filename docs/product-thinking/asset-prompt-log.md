# Asset Prompt Log — Clash v2 Sprites (Day 23)

**Generation date:** 2026-05-12
**Pipeline:** `scripts/gen-sprites.ts` → `qa-sprites.ts` → `optimize-sprites.ts`
**Model:** `gpt-image-2` via bytecat OpenAI-compatible proxy (`https://www.bytecatcode.org`)
**Resolution:** 1024×1024 single-frame transparent PNG per sprite
**Pack target:** 12 atlases (WebP), 2×2 grid (idle / walk / attack / death) per card,
total budget ≤ 3 MB lazy-loaded

---

## Style anchor

The anchor file `public/sprites/_ref/knight-anchor.png` was generated **once**
before the production batch and inspected against four binary criteria:

| # | criterion | accept |
|---|-----------|--------|
| 1 | dark fantasy cartoon tonality | ✓ |
| 2 | crisp 1.5 px black outline | ✓ |
| 3 | neon-lime (#b6ff3c) accent only on weapon edges + emblems | ✓ |
| 4 | fully transparent background, no ground shadow | ✓ |

Every later prompt closes with a "same outline weight, same flat cel-shading,
same lime accent placement, same navy palette" clause to anchor the style.
If you regenerate, re-run `--anchor` first and re-validate — a drifted anchor
poisons the whole batch.

### Anchor prompt (verbatim)

> A heroic armored human warrior with a longsword and a round shield, standing
> in a confident idle pose, Dark fantasy cartoon RPG sprite, isometric
> three-quarter view, 1.5px crisp black outline, neon lime accent (#b6ff3c)
> only on weapon edges and magical highlights, dark navy color palette
> (#0a0e1a base) with desaturated armor tones, single character centered,
> fully transparent PNG background (no ground shadow), no text, no UI, no
> border, no logo, flat colors with cel-shading, no photorealism, no
> gradients, character fills ~70% of the square frame. This is the *style
> anchor* — every later sprite will be generated to match this visual
> language.

---

## Per-card prompts

The script (`scripts/gen-sprites.ts`) composes prompts from three pieces:

1. **archetype** — short, neutral description of the character.
2. **pose** — `STATE_PROMPTS[state]` for idle / walk / attack / death.
3. **style suffix** — the shared style clause from the anchor.

### Archetype lines (`CardSpec.desc`)

| spriteId | DB cardId | archetype string |
|----------|-----------|------------------|
| knight | knight | armored human warrior with sword and round shield |
| archer | archer | hooded female elven archer drawing a longbow |
| goblin | goblin | tiny green-skinned goblin grinning with a dagger |
| giant | giant | huge muscular bald giant in tattered leather, massive fists |
| musketeer | musketeer | long-coat female musketeer aiming a flintlock rifle |
| valkyrie | valkyrie | fierce female valkyrie warrior with axe, braided hair, winged helm |
| mini_warrior | mini_pekka | short stout armored warrior with a giant warhammer |
| baby_dragon | baby_dragon | chubby cartoon baby dragon, small wings, breathing a tiny flame |
| cannon | cannon | wooden artillery cannon on wheels with iron barrel |
| tesla | tesla | arcane tesla coil tower crackling with violet lightning |
| arrows | arrows | a flight of glowing magical arrows in mid-air, fan formation |
| lightning | lightning | a forked lightning bolt arcing downward, neon white core, blue halo |

### Pose lines (`STATE_PROMPTS`)

- **idle** — *standing in a confident idle pose, weapon held relaxed at the ready, weight on back foot*
- **walk** — *mid-stride walking forward, one foot lifted, weapon swinging, slight forward lean*
- **attack** — *attacking forward with full force, weapon thrust or swung extended, body coiled with motion*
- **death** — *falling backward in death, body crumpling, weapon dropping, eyes closed, motion blur lines*

### State count per archetype

| archetype | states generated | rationale |
|-----------|------------------|-----------|
| regular units (8) | idle / walk / attack / death | full animation lifecycle |
| buildings (cannon, tesla) | idle / attack | buildings never walk; death is handled by Day 24 explosion FX, not a sprite |
| spells (arrows, lightning) | idle | spell is a one-shot effect; walk / attack / death are not semantically meaningful |

**Total raw sprites:** `8 × 4 + 2 × 2 + 2 × 1 = 38`
(plan 23 originally specified 48; we trimmed unused state combos — atlas
pipeline back-fills missing cells with the idle frame so the renderer can
always look up by state name.)

---

## IP-safety rename

The Supercell trademark `Mini P.E.K.K.A` is renamed for filenames and
visible UI strings:

| context | id used |
|---------|---------|
| database (`cr_cards.id`) | `mini_pekka` (unchanged — migration cost > benefit) |
| sprite filename | `mini_warrior-*.png` / `mini_warrior.webp` |
| English UI name | `Mini Warrior` |
| visual prompt | `short stout armored warrior with a giant warhammer` (avoids Supercell silhouette) |

The mapping lives in `src/clash/hooks/useClashAssets.ts:SPRITE_RENAME` and
the rename is applied centrally at sprite load time — engine logic continues
to use the original `CrCardId`.

---

## Retry queue

Failed generations are persisted to `scripts/retry-queue.json` so they can
be re-run without re-paying for the successes:

```bash
bun run scripts/gen-sprites.ts          # full run, skips existing PNGs
bun run scripts/gen-sprites.ts --force  # full rerun, overwriting
```

The script handles 429 / 5xx with up to three exponential-backoff retries
(1 s / 2 s / 4 s + jitter). 401 / 403 / 400 fail fast — those are
configuration problems (key, header, prompt content policy), not transient
errors.

---

## QA gate

`scripts/qa-sprites.ts` inspects every generated PNG using `sharp`:

| metric | threshold | reason |
|--------|-----------|--------|
| dimensions ≥ 256 × 256 | hard | flagging early ensures atlas cells stay sharp |
| has alpha channel | hard | dark navy on opaque white fails composite onto the navy battlefield |
| transparent area ≥ 15 % | soft | catches "full bleed" generations that ignored the transparent-BG clause |
| mean luma ≤ 180 | soft | catches palette-drift towards a pastel / bright background |
| Sobel-style edge density ≥ 4 % | soft | catches blurry / featureless silhouettes |

Failures are listed by file; user can `--force` regenerate just those
ids, or accept and manually move borderline sprites past the gate.

---

## Optimization

`scripts/optimize-sprites.ts` packs each card's states into a 2 × 2 grid,
encodes WebP at quality 85 / alphaQuality 90 / effort 5, and emits a
Pixi-compatible JSON atlas alongside.

- HTTP requests: 38 PNG → 12 atlas pairs (`<card>.webp` + `<card>.json`)
- Payload: targeted ≤ 3 MB total, lazy-loaded with `PixiBattlefield`
- Renderer entry point: `PIXI.Assets.load('/sprites/<card>.json')` returns
  a `Spritesheet` with `.textures.idle / walk / attack / death`

---

## How to re-run end-to-end

```bash
# 1. anchor (one-shot; rerun only on style drift)
bun run scripts/gen-sprites.ts --anchor

# 2. visually accept anchor → run pilot batch (4 cards, idle only)
bun run scripts/gen-sprites.ts --pilot

# 3. eyeball pilot atlas → full run
bun run scripts/gen-sprites.ts

# 4. automated quality gate (exit 1 on failures)
bun run scripts/qa-sprites.ts

# 5. pack into atlases (writes public/sprites/<card>.webp + .json)
bun run scripts/optimize-sprites.ts
```

Every script is idempotent: re-runs skip existing outputs unless `--force`.

---

## Open issues / known drift

- **Palette drift** — the first 256 × 256 batch generated before our raw-fetch
  rewrite returned violet / purple costumes on `valkyrie`, `baby_dragon`.
  Root cause was the OpenAI SDK's `X-Stainless-*` headers tripping the
  bytecat proxy WAF, which both returned a 403 _and_ silently rewrote the
  prompt. After dropping the SDK in favor of `fetch` with two minimal
  headers, the 1024 × 1024 anchor came back on-palette.
- **State semantics for spells** — only `idle` is meaningful; `attack` is
  reserved for a possible Day 24 particle reskin where the spell's icon
  briefly grows + flashes before the effect particles take over.
