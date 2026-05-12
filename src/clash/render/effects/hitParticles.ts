// Day 24 — On-hit particle burst.
//
// Spawned at target position when an attack lands. ~30 neon-lime squares
// scatter outward, fade and shrink over ~450ms, then the whole container
// destroys itself. Designed to be cheap: one PIXI.Container with N small
// Graphics children; ticker drives a single per-frame update.

import * as PIXI from 'pixi.js'
import { PALETTE } from '@/clash/render/palette'

const PARTICLE_COUNT = 14
const LIFETIME_MS = 360
const SPREAD = 16

interface Particle {
  g: PIXI.Graphics
  vx: number
  vy: number
}

export function emitHitParticles(
  layer: PIXI.Container,
  ticker: PIXI.Ticker,
  pos: { x: number; y: number },
  tint = PALETTE.player,
) {
  const cont = new PIXI.Container()
  cont.position.set(pos.x, pos.y)
  layer.addChild(cont)

  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = SPREAD * (0.4 + Math.random() * 0.6)
    const g = new PIXI.Graphics().rect(-1, -1, 2, 2).fill({ color: tint })
    cont.addChild(g)
    particles.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    })
  }

  const start = performance.now()
  const onTick = () => {
    const t = (performance.now() - start) / LIFETIME_MS
    if (t >= 1) {
      ticker.remove(onTick)
      cont.destroy({ children: true })
      return
    }
    const ease = 1 - Math.pow(1 - t, 2)
    for (const p of particles) {
      p.g.x = p.vx * ease
      p.g.y = p.vy * ease + 18 * t * t // mild gravity arc
      p.g.alpha = 1 - t
      p.g.scale.set(1 - t * 0.5)
    }
  }
  ticker.add(onTick)
}
