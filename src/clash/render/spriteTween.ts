// Day 23 — Procedural tweens applied per-tick on the unit body sprite.
//
// Each unit Container is positioned at the engine pos. Tweens manipulate the
// inner *body* child (sprite or graphics) so the parent's hp bar + side ring
// stay stable.
//
//   idle    — vertical bob (breathing)
//   walk    — gentle rotation swing (gait)
//   attack  — scale pulse (forward thrust feel)
//   death   — alpha fade + rotate sideways

import type { Container } from 'pixi.js'

export function applyIdleBob(body: Container, now: number, baseY = 0) {
  body.y = baseY + Math.sin((now / 600) * Math.PI * 2) * 1.5
  body.rotation = 0
  body.alpha = 1
}

export function applyWalkSwing(body: Container, now: number, baseY = 0) {
  body.y = baseY + Math.sin((now / 350) * Math.PI * 2) * 0.6
  body.rotation = Math.sin((now / 280) * Math.PI * 2) * 0.08
  body.alpha = 1
}

/**
 * Attack pulse — scale spikes from 1.0 to ~1.15 and back over the attack
 * cooldown's tail. `cooldown` here is the engine-reported time-to-next-shot.
 */
export function applyAttackThrust(
  body: Container,
  now: number,
  baseY = 0,
  cooldown = 0,
) {
  body.y = baseY
  body.rotation = 0
  body.alpha = 1
  // cooldown ramps from full down to 0 as the attack resolves; use sin over
  // a fixed 200ms window keyed off the clock so multiple units don't lockstep.
  const pulse = Math.max(0, 0.2 - cooldown) / 0.2
  const wave = Math.sin(pulse * Math.PI)
  body.scale.set(1 + wave * 0.15)
  if (!wave) {
    // Outside the pulse window, still let the body breathe a touch.
    body.scale.set(1 + Math.sin((now / 600) * Math.PI * 2) * 0.02)
  }
}

/**
 * Death — rotate 90° sideways and fade to 0 over the engine's deathFadeSec.
 * `progress` is 0..1 (0 = just died, 1 = removed).
 */
export function applyDeathFade(body: Container, progress: number, baseY = 0) {
  const p = Math.min(1, Math.max(0, progress))
  body.y = baseY
  body.rotation = (Math.PI / 2) * p
  body.alpha = 1 - p
  body.scale.set(1 - p * 0.2)
}

/**
 * Spawning — slight rise from below + fade in over ~spawnFreezeSec.
 */
export function applySpawnRise(body: Container, progress: number, baseY = 0) {
  const p = Math.min(1, Math.max(0, progress))
  const eased = 1 - Math.pow(1 - p, 3)
  body.y = baseY + (1 - eased) * 18
  body.rotation = 0
  body.alpha = 0.4 + 0.6 * eased
  body.scale.set(0.8 + 0.2 * eased)
}

/**
 * Reset transforms to neutral — used when swapping textures between states.
 */
export function resetBodyTransform(body: Container, baseY = 0) {
  body.y = baseY
  body.rotation = 0
  body.alpha = 1
  body.scale.set(1)
}
