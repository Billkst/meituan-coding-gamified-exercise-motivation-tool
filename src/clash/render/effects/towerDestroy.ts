// Day 24 — Tower destruction shockwave.
//
// When a tower falls: emit a central flash + expanding ring + a second ring
// for depth + a burst of debris particles. The CSS-driven screen shake is
// applied to the wrapper element separately (see useScreenShake helper at
// the bottom of this file).

import * as PIXI from 'pixi.js'
import { PALETTE } from '@/clash/render/palette'

const DURATION_MS = 700

export function emitTowerDestroy(
  layer: PIXI.Container,
  ticker: PIXI.Ticker,
  pos: { x: number; y: number },
  tint: number,
) {
  const cont = new PIXI.Container()
  cont.position.set(pos.x, pos.y)
  layer.addChild(cont)

  // Central flash.
  const flash = new PIXI.Graphics().circle(0, 0, 5).fill({ color: PALETTE.grid, alpha: 1 })
  cont.addChild(flash)

  // Two staggered shockwave rings.
  const ringA = new PIXI.Graphics()
    .circle(0, 0, 6)
    .stroke({ color: tint, width: 2, alpha: 1 })
  const ringB = new PIXI.Graphics()
    .circle(0, 0, 6)
    .stroke({ color: PALETTE.grid, width: 1, alpha: 0.7 })
  cont.addChild(ringA, ringB)

  // Debris squares.
  const DEBRIS = 10
  type Bit = { g: PIXI.Graphics; vx: number; vy: number; rot: number }
  const bits: Bit[] = []
  for (let i = 0; i < DEBRIS; i++) {
    const g = new PIXI.Graphics()
      .rect(-1.5, -1.5, 3, 3)
      .fill({ color: tint, alpha: 0.9 })
    cont.addChild(g)
    const a = Math.random() * Math.PI * 2
    const speed = 32 + Math.random() * 40
    bits.push({
      g,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 20,
      rot: (Math.random() - 0.5) * 0.4,
    })
  }

  const start = performance.now()
  const onTick = () => {
    const t = (performance.now() - start) / DURATION_MS
    if (t >= 1) {
      ticker.remove(onTick)
      cont.destroy({ children: true })
      return
    }
    const easeOut = 1 - Math.pow(1 - t, 3)

    flash.alpha = 1 - t * 1.4
    flash.scale.set(1 + t * 2.5)

    ringA.alpha = 1 - t
    ringA.scale.set(1 + easeOut * 8)
    ringB.alpha = 0.7 * (1 - t)
    ringB.scale.set(1 + easeOut * 12)

    for (const b of bits) {
      const tSec = t * (DURATION_MS / 1000)
      b.g.x = b.vx * tSec
      b.g.y = b.vy * tSec + 110 * tSec * tSec // gravity
      b.g.rotation += b.rot
      b.g.alpha = 1 - t
    }
  }
  ticker.add(onTick)
}

/**
 * Trigger a one-shot screen shake on a DOM element by toggling a CSS class
 * that runs a keyframes animation. Caller owns adding the matching keyframes
 * to the global stylesheet (see PixiBattlefield wrapper class).
 */
export function triggerScreenShake(target: HTMLElement | null, durationMs = 320) {
  if (!target) return
  target.classList.remove('clash-shake')
  // Force reflow so re-adding the class restarts the animation.
  void target.offsetWidth
  target.classList.add('clash-shake')
  window.setTimeout(() => target.classList.remove('clash-shake'), durationMs)
}
