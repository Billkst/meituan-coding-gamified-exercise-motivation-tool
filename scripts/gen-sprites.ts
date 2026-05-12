// Day 23 — gpt-image-2 sprite generation pipeline.
//
// Modes:
//   --anchor  one-shot, writes public/sprites/_ref/knight-anchor.png
//   --pilot   4 idle sprites (knight, archer, valkyrie, baby_dragon)
//   (none)    full 12 cards × 4 states = 48 sprites
//
// Usage (user terminal — Claude's auto-mode classifier blocks credential
// transmission to non-trusted proxies, so this script must be run by hand):
//
//   bun run scripts/gen-sprites.ts --anchor
//   bun run scripts/gen-sprites.ts --pilot
//   bun run scripts/gen-sprites.ts
//
// Resume-friendly: existing PNGs are skipped unless --force.
//
// Env (from .env.local):
//   OPENAI_API_KEY     bytecat-issued key (starts with sk-)
//   OPENAI_BASE_URL    https://www.bytecatcode.org
//   OPENAI_MODEL       override (default: gpt-image-2)

// Bytecat's WAF rejects the OpenAI SDK's tracking headers (X-Stainless-*)
// with 403 "Your request was blocked.", so we use raw fetch with only
// the minimal headers curl sends. The SDK is still in devDeps for type
// reference but not invoked here.

import 'dotenv/config'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

type State = 'idle' | 'walk' | 'attack' | 'death'

interface CardSpec {
  /** sprite file id — IP-safe (mini_pekka → mini_warrior). */
  spriteId: string
  /** archetype descriptor used in the prompt. */
  desc: string
  /** spell cards skip walk/attack/death states. */
  isSpell?: boolean
  /** building cards (cannon, tesla) only need idle + attack. */
  isBuilding?: boolean
}

const CARDS: CardSpec[] = [
  { spriteId: 'knight', desc: 'armored human warrior with sword and round shield' },
  { spriteId: 'archer', desc: 'hooded female elven archer drawing a longbow' },
  { spriteId: 'goblin', desc: 'tiny green-skinned goblin grinning with a dagger' },
  { spriteId: 'giant', desc: 'huge muscular bald giant in tattered leather, massive fists' },
  { spriteId: 'musketeer', desc: 'long-coat female musketeer aiming a flintlock rifle' },
  { spriteId: 'valkyrie', desc: 'fierce female valkyrie warrior with axe, braided hair, winged helm' },
  { spriteId: 'mini_warrior', desc: 'short stout armored warrior with a giant warhammer' },
  { spriteId: 'baby_dragon', desc: 'chubby cartoon baby dragon, small wings, breathing a tiny flame' },
  { spriteId: 'cannon', desc: 'wooden artillery cannon on wheels with iron barrel', isBuilding: true },
  { spriteId: 'tesla', desc: 'arcane tesla coil tower crackling with violet lightning', isBuilding: true },
  { spriteId: 'arrows', desc: 'a flight of glowing magical arrows in mid-air, fan formation', isSpell: true },
  { spriteId: 'lightning', desc: 'a forked lightning bolt arcing downward, neon white core, blue halo', isSpell: true },
]

const STATE_PROMPTS: Record<State, string> = {
  idle: 'standing in a confident idle pose, weapon held relaxed at the ready, weight on back foot',
  walk: 'mid-stride walking forward, one foot lifted, weapon swinging, slight forward lean',
  attack: 'attacking forward with full force, weapon thrust or swung extended, body coiled with motion',
  // Defeated pose — softened from "death/crumpling" to avoid tripping
  // image-model content filters on humanoid characters. Visually reads the
  // same: leaning back, defeated, weapon slipping from hand.
  death: 'in a defeated knockout pose, leaning backward with arms slack, weapon slipping from hand, cartoon dazed expression with stars or swirls overhead, motion lines suggesting impact, non-violent stylized cartoon defeat',
}

const STYLE_SUFFIX = [
  'Dark fantasy cartoon RPG sprite, isometric three-quarter view,',
  '1.5px crisp black outline, neon lime accent (#b6ff3c) only on weapon edges and magical highlights,',
  'dark navy color palette (#0a0e1a base) with desaturated armor tones,',
  'single character centered, fully transparent PNG background (no ground shadow),',
  'no text, no UI, no border, no logo,',
  'flat colors with cel-shading, no photorealism, no gradients,',
  'character fills ~70% of the square frame.',
].join(' ')

const STATES_PER_CARD = (c: CardSpec): State[] => {
  if (c.isSpell) return ['idle'] // spells have only one visual state (effect itself)
  if (c.isBuilding) return ['idle', 'attack']
  return ['idle', 'walk', 'attack', 'death']
}

const args = new Set(process.argv.slice(2))
const MODE: 'anchor' | 'pilot' | 'full' = args.has('--anchor')
  ? 'anchor'
  : args.has('--pilot')
    ? 'pilot'
    : 'full'
const FORCE = args.has('--force')

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-image-2'
const OUT_DIR = 'public/sprites/raw'
const REF_DIR = 'public/sprites/_ref'
const ANCHOR_PATH = `${REF_DIR}/knight-anchor.png`

async function ensureDirs() {
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(REF_DIR, { recursive: true })
}

function buildPrompt(card: CardSpec, state: State): string {
  return [
    `A ${card.desc}, ${STATE_PROMPTS[state]}.`,
    STYLE_SUFFIX,
    `Match the visual style of the established style anchor (knight reference): same outline weight,`,
    `same flat cel-shading, same neon-lime accent placement, same dark navy palette.`,
  ].join(' ')
}

function anchorPrompt(): string {
  return [
    'A heroic armored human warrior with a longsword and a round shield, standing in a confident idle pose,',
    STYLE_SUFFIX,
    'This is the *style anchor* — every later sprite will be generated to match this visual language.',
  ].join(' ')
}

interface ImageResp {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string; code?: string; type?: string }
}

async function callImage(prompt: string, retries = 3): Promise<Buffer> {
  const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com').replace(/\/$/, '')
  const url = `${base}/v1/images/generations`
  // background:'transparent' is documented for gpt-image-* — some proxies
  // strip unknown fields. Sending it is harmless if ignored, and when honored
  // we get real alpha out instead of a painted checker (which the optimize
  // step then doesn't have to chromakey).
  const body = JSON.stringify({
    model: MODEL,
    prompt,
    n: 1,
    size: '1024x1024',
    background: 'transparent',
  })
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const err = new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`)
        ;(err as { status?: number }).status = res.status
        throw err
      }
      const json = (await res.json()) as ImageResp
      const item = json.data?.[0]
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
      if (item?.url) {
        const dl = await fetch(item.url)
        if (!dl.ok) throw new Error(`download failed: HTTP ${dl.status}`)
        return Buffer.from(await dl.arrayBuffer())
      }
      throw new Error(`no image payload: ${JSON.stringify(json).slice(0, 200)}`)
    } catch (e: unknown) {
      lastErr = e
      const status = (e as { status?: number })?.status ?? 0
      if (status !== 429 && status < 500 && status !== 0) throw e
      const wait = 1000 * Math.pow(2, attempt) + Math.random() * 500
      console.warn(`  retry ${attempt + 1}/${retries} after ${Math.round(wait)}ms (status ${status})`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

async function generateOne(prompt: string, outPath: string): Promise<'skip' | 'ok' | 'fail'> {
  if (!FORCE && existsSync(outPath)) {
    const s = await stat(outPath)
    if (s.size > 1024) return 'skip'
  }
  try {
    const buf = await callImage(prompt)
    await writeFile(outPath, buf)
    console.log(`  ✓ ${outPath} (${(buf.byteLength / 1024).toFixed(1)} KB)`)
    return 'ok'
  } catch (e: unknown) {
    console.error(`  ✗ ${outPath} —`, (e as Error)?.message || e)
    return 'fail'
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in .env.local')
    process.exit(1)
  }
  await ensureDirs()

  console.log(`[gen-sprites] mode=${MODE} model=${MODEL} baseURL=${process.env.OPENAI_BASE_URL ?? '(openai default)'}`)

  // Build the work queue per mode.
  type Job = { prompt: string; outPath: string; label: string }
  const queue: Job[] = []

  if (MODE === 'anchor') {
    queue.push({ prompt: anchorPrompt(), outPath: ANCHOR_PATH, label: 'knight-anchor' })
  } else if (MODE === 'pilot') {
    const pilotIds = new Set(['knight', 'archer', 'valkyrie', 'baby_dragon'])
    for (const card of CARDS.filter((c) => pilotIds.has(c.spriteId))) {
      queue.push({
        prompt: buildPrompt(card, 'idle'),
        outPath: `${OUT_DIR}/${card.spriteId}-idle.png`,
        label: `${card.spriteId}-idle`,
      })
    }
  } else {
    for (const card of CARDS) {
      for (const state of STATES_PER_CARD(card)) {
        queue.push({
          prompt: buildPrompt(card, state),
          outPath: `${OUT_DIR}/${card.spriteId}-${state}.png`,
          label: `${card.spriteId}-${state}`,
        })
      }
    }
  }

  console.log(`[gen-sprites] ${queue.length} sprites to generate`)
  let ok = 0,
    skip = 0,
    fail = 0
  const failQueue: { label: string; prompt: string; outPath: string }[] = []

  for (let i = 0; i < queue.length; i++) {
    const job = queue[i]
    process.stdout.write(`[${i + 1}/${queue.length}] ${job.label} … `)
    const result = await generateOne(job.prompt, job.outPath)
    if (result === 'ok') ok++
    else if (result === 'skip') {
      skip++
      console.log(`(skip — exists, --force to redo)`)
    } else {
      fail++
      failQueue.push(job)
    }
  }

  console.log(`\n[gen-sprites] done — ok=${ok} skip=${skip} fail=${fail}`)
  if (failQueue.length) {
    await writeFile(
      'scripts/retry-queue.json',
      JSON.stringify(failQueue, null, 2),
    )
    console.log(`[gen-sprites] wrote failures to scripts/retry-queue.json`)
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('[gen-sprites] fatal —', err?.message || err)
  if (err?.status) console.error('  http status:', err.status, err?.error)
  process.exit(3)
})
