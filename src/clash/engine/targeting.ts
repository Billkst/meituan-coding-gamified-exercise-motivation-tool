// Target selection — picks the best valid target for an attacker.
// Pure: never mutates state.

import { ARENA, type Side, type TowerId } from '@/clash/lib/arena'
import type { CrTargetType } from '@/clash/lib/cardData'
import type { MatchState, Unit, Vec2 } from './types'
import { dist } from './unit'

export type TargetId = string

export function isTowerId(id: string): id is TowerId {
  return id in ARENA.towers
}

/** Look up a target's current position, or null if dead/missing. */
export function getTargetPos(state: MatchState, id: TargetId): Vec2 | null {
  if (isTowerId(id)) {
    const tower = state.towers.find((t) => t.id === id)
    return tower && tower.hp > 0 ? tower.pos : null
  }
  const unit = state.units.find((u) => u.id === id)
  return unit && unit.hp > 0 ? unit.pos : null
}

function canHitAir(targetType: CrTargetType, isAir: boolean): boolean {
  if (!isAir) return true
  return targetType === 'air+ground'
}

interface CandidateMatch {
  id: TargetId
  pos: Vec2
  distance: number
}

/**
 * Sight range — how far an attacker can "see" / aggro a target.
 *
 * Without this, pickTarget returned the closest enemy on the entire field,
 * so a knight walking the left lane would aggro a cannon dropped in the
 * opposite back corner and walk diagonally across the river. Clash Royale's
 * real sight cone is about 5.5 tiles for melee troops.
 *
 * - Troops: max(stats.range + 3, 5.5). Ranged units (musketeer range 6)
 *   get a slightly larger cone so they aggro stuff they could already hit.
 * - Buildings: stats.range. Buildings don't chase, so seeing past their
 *   own attack range serves no purpose.
 */
export function sightRangeFor(attacker: Unit): number {
  if (attacker.isBuilding) return attacker.stats.range
  return Math.max(attacker.stats.range + 3, 5.5)
}

/**
 * Pick the best target for `attacker` from the live state.
 *
 * Rules:
 *   - Only enemies of `attacker.side`.
 *   - Must be within sight range (see `sightRangeFor`).
 *   - target='building' (e.g. Giant) ignores troops, only hits buildings + towers.
 *   - target='ground' ignores air units (e.g. Baby Dragon).
 *   - King towers are dormant until activated (princess down OR direct hit).
 *   - Anti-jitter: keep current target if still valid AND still in sight.
 *   - Otherwise: closest by Euclidean distance.
 */
export function pickTarget(state: MatchState, attacker: Unit): TargetId | null {
  const enemySide: Side = attacker.side === 'player' ? 'enemy' : 'player'
  const tt = attacker.stats.target
  const sight = sightRangeFor(attacker)
  const candidates: CandidateMatch[] = []

  for (const u of state.units) {
    if (u.side !== enemySide) continue
    if (u.hp <= 0 || u.state === 'dying' || u.state === 'dead') continue
    if (tt === 'building' && !u.isBuilding) continue
    if (!canHitAir(tt, u.isAir)) continue
    const d = dist(attacker.pos, u.pos)
    if (d > sight) continue
    candidates.push({ id: u.id, pos: u.pos, distance: d })
  }

  for (const t of state.towers) {
    if (t.side !== enemySide) continue
    if (t.hp <= 0) continue
    if (t.isKing && !t.isActive) continue
    const d = dist(attacker.pos, t.pos)
    if (d > sight) continue
    candidates.push({ id: t.id, pos: t.pos, distance: d })
  }

  if (candidates.length === 0) return null

  if (attacker.targetId) {
    const cur = candidates.find((c) => c.id === attacker.targetId)
    if (cur) return cur.id
  }

  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0].id
}
