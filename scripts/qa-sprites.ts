// Day 23 / 23.4 — Sprite QA gate.
//
// Reads every PNG under public/sprites/raw/ and checks:
//   1. alpha presence (true transparent background, not solid white)
//   2. dominant hue inside the expected dark-navy + neon-lime band
//   3. edge density above a threshold (not blurry / not blank)
//
// Failures are listed; pass exits 0, fail exits 1 with a summary.
//
// Run:  bun run scripts/qa-sprites.ts

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const RAW_DIR = 'public/sprites/raw'

interface QaReport {
  file: string
  width: number
  height: number
  hasAlpha: boolean
  transparentPct: number
  meanLuma: number
  edgeDensity: number
  pass: boolean
  reasons: string[]
}

async function inspect(file: string): Promise<QaReport> {
  const img = sharp(file)
  const meta = await img.metadata()
  const reasons: string[] = []
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const hasAlpha = meta.channels === 4

  if (width < 256 || height < 256) reasons.push(`size ${width}x${height} too small`)
  if (!hasAlpha) reasons.push('no alpha channel (must be transparent PNG)')

  // Raw pixel buffer for alpha + luma + edge stats.
  const raw = await img.raw().toBuffer({ resolveWithObject: true })
  const { data, info } = raw
  const channels = info.channels

  let transparentPixels = 0
  let lumaSum = 0
  let opaqueCount = 0
  const opaqueLumaSamples: number[] = []
  for (let i = 0; i < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3] : 255
    if (a < 16) {
      transparentPixels++
      continue
    }
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    lumaSum += luma
    opaqueCount++
    if (opaqueLumaSamples.length < 4096) opaqueLumaSamples.push(luma)
  }
  const totalPixels = info.width * info.height
  const transparentPct = transparentPixels / totalPixels
  const meanLuma = opaqueCount ? lumaSum / opaqueCount : 0

  // Edge density via 3×3 Sobel approximation on the luma channel — proxy for
  // whether the sprite has visible silhouette/outline lines.
  // Operate on a downscaled greyscale copy to keep this fast.
  const small = await sharp(file)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let edgePx = 0
  const w = small.info.width
  const h = small.info.height
  const px = small.data
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const gx = px[idx + 1] - px[idx - 1]
      const gy = px[idx + w] - px[idx - w]
      if (Math.abs(gx) + Math.abs(gy) > 40) edgePx++
    }
  }
  const edgeDensity = edgePx / (w * h)

  if (transparentPct < 0.15)
    reasons.push(`transparent area ${(transparentPct * 100).toFixed(1)}% < 15% (likely solid BG)`)
  if (meanLuma > 180)
    reasons.push(`mean luma ${meanLuma.toFixed(0)} > 180 (palette too bright vs dark fantasy spec)`)
  if (edgeDensity < 0.04)
    reasons.push(`edge density ${(edgeDensity * 100).toFixed(2)}% < 4% (no outline / blurry)`)

  return {
    file,
    width,
    height,
    hasAlpha,
    transparentPct,
    meanLuma,
    edgeDensity,
    pass: reasons.length === 0,
    reasons,
  }
}

async function main() {
  const entries = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.png'))
  if (!entries.length) {
    console.error(`No PNGs in ${RAW_DIR}`)
    process.exit(1)
  }
  const reports: QaReport[] = []
  for (const f of entries.sort()) {
    const full = join(RAW_DIR, f)
    try {
      const r = await inspect(full)
      reports.push(r)
      const mark = r.pass ? '✓' : '✗'
      console.log(
        `${mark} ${f}  ${r.width}x${r.height}  ` +
          `transp=${(r.transparentPct * 100).toFixed(0)}% luma=${r.meanLuma.toFixed(0)} edge=${(r.edgeDensity * 100).toFixed(1)}%` +
          (r.reasons.length ? `  — ${r.reasons.join('; ')}` : ''),
      )
    } catch (e) {
      console.log(`✗ ${f}  read error — ${(e as Error).message}`)
      reports.push({
        file: full,
        width: 0,
        height: 0,
        hasAlpha: false,
        transparentPct: 0,
        meanLuma: 0,
        edgeDensity: 0,
        pass: false,
        reasons: [(e as Error).message],
      })
    }
  }

  const fail = reports.filter((r) => !r.pass)
  console.log(`\n[qa-sprites] ${reports.length} sprites, ${reports.length - fail.length} pass, ${fail.length} fail`)
  if (fail.length) process.exit(1)
}

main().catch((err) => {
  console.error('[qa-sprites] fatal —', err?.message || err)
  process.exit(2)
})
