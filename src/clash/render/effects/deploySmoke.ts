// Day 24 — Deploy smoke puff.
//
// Played at deploy position when a unit is placed. A ring + 6 small puffs
// expand outward over ~360ms, fading to nothing.

import * as PIXI from 'pixi.js'
import { PALETTE } from '@/clash/render/palette'

const DURATION_MS = 360
const PUFF_COUNT = 6

export function emitDeploySmoke(
  layer: PIXI.Container,
  ticker: PIXI.Ticker,
  pos: { x: number; y: number },
  tint: number,
) {
  const cont = new PIXI.Container()
  cont.position.set(pos.x, pos.y)
  layer.addChild(cont)

  const ring = new PIXI.Graphics()
    .circle(0, 0, 6)
    .stroke({ color: tint, width: 2, alpha: 0.9 })
  cont.addChild(ring)

  type Puff = { g: PIXI.Graphics; tx: number; ty: number }
  const puffs: Puff[] = []
  for (let i = 0; i < PUFF_COUNT; i++) {
    const angle = (i / PUFF_COUNT) * Math.PI * 2 + Math.random() * 0.4
    const dist = 14 + Math.random() * 6
    const g = new PIXI.Graphics()
      .circle(0, 0, 4)
      .fill({ color: PALETTE.grid, alpha: 0.55 })
    cont.addChild(g)
    puffs.push({ g, tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist })
  }

  const start = performance.now()
  const onTick = () => {
    const t = (performance.now() - start) / DURATION_MS
    if (t >= 1) {
      ticker.remove(onTick)
      cont.destroy({ children: true })
      return
    }
    const easeOut = 1 - Math.pow(1 - t, 2)
    ring.alpha = 0.9 * (1 - t)
    ring.scale.set(1 + easeOut * 4)
    for (const p of puffs) {
      p.g.x = p.tx * easeOut
      p.g.y = p.ty * easeOut
      p.g.alpha = 0.55 * (1 - t)
      p.g.scale.set(0.6 + easeOut * 0.8)
    }
  }
  ticker.add(onTick)
}
