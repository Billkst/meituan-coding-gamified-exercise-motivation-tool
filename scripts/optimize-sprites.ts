// Day 23 / 23.5 — Sprite optimization pipeline.
//
// Reads public/sprites/raw/<card>-<state>.png, produces:
//   - public/sprites/<card>.webp  (atlas image, 2×2 grid of states)
//   - public/sprites/<card>.json  (Pixi-compatible atlas JSON)
//
// Per-card the atlas is a fixed 2×2 grid (top-left=idle, top-right=walk,
// bottom-left=attack, bottom-right=death). Spell cards (arrows, lightning)
// only have idle — the atlas fills the other 3 cells with their idle so the
// renderer can always look up by state name without a null-check.
//
// Cell size is the largest source dimension among the card's states, capped
// at 512px to keep atlases below 1MB each.
//
// Run:  bun run scripts/optimize-sprites.ts

import { readdir, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const RAW_DIR = 'public/sprites/raw'
const OUT_DIR = 'public/sprites'

type State = 'idle' | 'walk' | 'attack' | 'death'
const STATES: State[] = ['idle', 'walk', 'attack', 'death']
const CELL_MAX = 512

interface AtlasJson {
  meta: { image: string; format: 'RGBA8888'; size: { w: number; h: number }; scale: 1 }
  frames: Record<State, { frame: { x: number; y: number; w: number; h: number } }>
}

async function findRawCards(): Promise<Map<string, Partial<Record<State, string>>>> {
  const files = await readdir(RAW_DIR)
  const byCard = new Map<string, Partial<Record<State, string>>>()
  for (const f of files) {
    const m = f.match(/^([a-z_]+)-(idle|walk|attack|death)\.png$/)
    if (!m) continue
    const [, card, state] = m
    if (!byCard.has(card)) byCard.set(card, {})
    byCard.get(card)![state as State] = join(RAW_DIR, f)
  }
  return byCard
}

/**
 * gpt-image-2 sometimes paints the "transparent" checker pattern *into* the
 * image instead of emitting alpha. Detect that and chromakey the gray
 * checker out: any pixel that is (a) light, (b) low-chroma, becomes alpha 0.
 * Dark navy body pixels (<100 luma) and high-chroma lime/neon accents pass
 * through untouched.
 */
async function ensureTransparentBackground(srcPath: string): Promise<Buffer> {
  const meta = await sharp(srcPath).metadata()
  const hasAlpha = meta.hasAlpha === true || meta.channels === 4
  // Always run a normalize → 4-channel buffer pipeline so callers get
  // consistent RGBA output regardless of what the source claimed.
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (hasAlpha) {
    // Source already had real alpha — just re-encode as PNG bytes.
    return sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer()
  }
  // Chromakey the painted checker.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const chroma = mx - mn
    const isLight = mn >= 170
    const isLowChroma = chroma <= 20
    if (isLight && isLowChroma) {
      data[i + 3] = 0
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

async function buildAtlas(cardId: string, sources: Partial<Record<State, string>>) {
  // Decide cell size from the largest source we have.
  let cell = 0
  for (const state of STATES) {
    const src = sources[state] ?? sources.idle
    if (!src) continue
    const meta = await sharp(src).metadata()
    cell = Math.max(cell, meta.width ?? 0, meta.height ?? 0)
  }
  cell = Math.min(cell || 256, CELL_MAX)
  const atlasSize = cell * 2

  // Composite the 2×2 grid.
  const positions: Record<State, { x: number; y: number }> = {
    idle: { x: 0, y: 0 },
    walk: { x: cell, y: 0 },
    attack: { x: 0, y: cell },
    death: { x: cell, y: cell },
  }
  const composites: Array<{ input: Buffer; left: number; top: number }> = []
  for (const state of STATES) {
    const src = sources[state] ?? sources.idle
    if (!src) continue
    const transparentPng = await ensureTransparentBackground(src)
    const cellBuf = await sharp(transparentPng)
      .resize(cell, cell, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: cellBuf, left: positions[state].x, top: positions[state].y })
  }

  const atlasWebp = await sharp({
    create: {
      width: atlasSize,
      height: atlasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 85, alphaQuality: 90, effort: 5 })
    .toBuffer()

  const outImg = join(OUT_DIR, `${cardId}.webp`)
  const outJson = join(OUT_DIR, `${cardId}.json`)
  await writeFile(outImg, atlasWebp)

  const json: AtlasJson = {
    meta: {
      image: `${cardId}.webp`,
      format: 'RGBA8888',
      size: { w: atlasSize, h: atlasSize },
      scale: 1,
    },
    frames: {
      idle: { frame: { x: positions.idle.x, y: positions.idle.y, w: cell, h: cell } },
      walk: { frame: { x: positions.walk.x, y: positions.walk.y, w: cell, h: cell } },
      attack: { frame: { x: positions.attack.x, y: positions.attack.y, w: cell, h: cell } },
      death: { frame: { x: positions.death.x, y: positions.death.y, w: cell, h: cell } },
    },
  }
  await writeFile(outJson, JSON.stringify(json, null, 2))
  return { outImg, atlasSize, bytes: atlasWebp.byteLength }
}

async function main() {
  if (!existsSync(RAW_DIR)) {
    console.error(`No ${RAW_DIR} — run gen-sprites first`)
    process.exit(1)
  }
  await mkdir(OUT_DIR, { recursive: true })

  const byCard = await findRawCards()
  if (!byCard.size) {
    console.error(`No card sprites found in ${RAW_DIR}`)
    process.exit(1)
  }

  console.log(`[optimize-sprites] packing ${byCard.size} atlases…`)
  let totalBytes = 0
  for (const [card, srcs] of [...byCard.entries()].sort()) {
    if (!srcs.idle) {
      console.warn(`  ! ${card} — missing idle state, skipping`)
      continue
    }
    const { outImg, atlasSize, bytes } = await buildAtlas(card, srcs)
    totalBytes += bytes
    console.log(`  ✓ ${outImg}  ${atlasSize}×${atlasSize}  ${(bytes / 1024).toFixed(0)} KB`)
  }
  console.log(`\n[optimize-sprites] total payload: ${(totalBytes / 1024 / 1024).toFixed(2)} MB across ${byCard.size} atlases`)
}

main().catch((err) => {
  console.error('[optimize-sprites] fatal —', err?.message || err)
  process.exit(2)
})
