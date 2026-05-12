// Day 24 — Projectile flight (arrows / fireballs).
//
// Eased linear flight with a subtle vertical arc, ~250ms travel, hit-flash
// ring on arrival. The engine itself resolves attacks instantaneously; the
// projectile here is purely cosmetic, fired off the attack log entry when
// the attacker has range > 2 cells.

import * as PIXI from 'pixi.js'
import { PALETTE } from '@/clash/render/palette'
import { emitHitParticles } from './hitParticles'

interface ProjectileOpts {
  kind: 'arrow' | 'fireball'
  tint?: number
  flightMs?: number
}

const DEFAULTS: Record<ProjectileOpts['kind'], { tint: number; flightMs: number }> = {
  arrow: { tint: PALETTE.player, flightMs: 220 },
  fireball: { tint: PALETTE.fire, flightMs: 360 },
}

export function emitProjectile(
  layer: PIXI.Container,
  ticker: PIXI.Ticker,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: ProjectileOpts,
) {
  const { tint, flightMs } = { ...DEFAULTS[opts.kind], ...opts }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)

  let g: PIXI.Graphics
  if (opts.kind === 'arrow') {
    g = new PIXI.Graphics()
      .moveTo(-6, 0)
      .lineTo(6, 0)
      .stroke({ color: tint, width: 1.5 })
      .moveTo(6, 0)
      .lineTo(2, -2)
      .lineTo(2, 2)
      .lineTo(6, 0)
      .fill({ color: tint })
  } else {
    g = new PIXI.Graphics()
      .circle(0, 0, 4)
      .fill({ color: tint })
      .stroke({ color: 0xfff5d6 /* keep — fireball core highlight, non-token */, width: 1, alpha: 0.85 })
  }
  g.position.set(from.x, from.y)
  g.rotation = angle
  layer.addChild(g)

  // Light trailing dots for fireball. We intentionally do NOT track or
  // pre-destroy these from the main onTick — each dot owns its own dotTick
  // that cleans up at the end of its 280 ms life. Externally destroying
  // them while dotTick is still queued causes Pixi to throw on the
  // destroyed Graphics' transform setter, which silently breaks the entire
  // ticker iteration ⇒ the whole match appears to freeze. (Root cause of
  // the "baby_dragon attack hangs the game" report.)
  const start = performance.now()
  const onTick = () => {
    if (g.destroyed) {
      ticker.remove(onTick)
      return
    }
    const elapsed = performance.now() - start
    const t = elapsed / flightMs
    if (t >= 1) {
      ticker.remove(onTick)
      g.destroy()
      emitHitParticles(layer, ticker, to, tint)
      // Brief hit ring.
      const ring = new PIXI.Graphics()
        .circle(0, 0, 6)
        .stroke({ color: tint, width: 2, alpha: 0.9 })
      ring.position.set(to.x, to.y)
      layer.addChild(ring)
      const ringStart = performance.now()
      const ringTick = () => {
        if (ring.destroyed) {
          ticker.remove(ringTick)
          return
        }
        const k = (performance.now() - ringStart) / 220
        if (k >= 1) {
          ticker.remove(ringTick)
          ring.destroy()
          return
        }
        ring.alpha = 1 - k
        ring.scale.set(1 + k * 3)
      }
      ticker.add(ringTick)
      return
    }
    // Slight upward arc so projectiles read as flying, not sliding.
    const arc = Math.sin(t * Math.PI) * Math.min(dist * 0.12, 18)
    g.x = from.x + dx * t
    g.y = from.y + dy * t - arc

    if (opts.kind === 'fireball' && elapsed % 40 < 17) {
      const dot = new PIXI.Graphics()
        .circle(0, 0, 2.5)
        .fill({ color: tint, alpha: 0.6 })
      dot.position.set(g.x, g.y)
      layer.addChild(dot)
      const dotStart = performance.now()
      const dotTick = () => {
        if (dot.destroyed) {
          ticker.remove(dotTick)
          return
        }
        const k = (performance.now() - dotStart) / 280
        if (k >= 1) {
          ticker.remove(dotTick)
          dot.destroy()
          return
        }
        dot.alpha = 0.6 * (1 - k)
        dot.scale.set(1 - k * 0.6)
      }
      ticker.add(dotTick)
    }
  }
  ticker.add(onTick)
}
