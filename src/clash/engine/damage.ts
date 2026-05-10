// Damage application — mutates state. Used by tick.ts.
// Two flows: direct attack (unit / tower hits target) and spell (area effect).

import { CR_CARDS_BY_ID, scaleStatsForLevel } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import type { Side } from '@/clash/lib/arena'
import { isTowerId } from './targeting'
import { dist } from './unit'
import type { DamageEvent, MatchState, Unit, Vec2 } from './types'

export interface AttackOutcome {
  /** Net damage actually dealt to the primary target. */
  primaryDamage: number
  /** Splash damage events for renderer. */
  splashHits: number
  primaryDied: boolean
}

/**
 * Apply a unit's attack against a target id. Mutates state in place.
 * Returns aggregated outcome for logging.
 */
export function applyAttack(
  state: MatchState,
  attacker: Unit,
  targetId: string,
): AttackOutcome {
  const dmg = attacker.stats.dmg
  const splashRadius = attacker.stats.splashRadius
  let primaryDamage = 0
  let primaryDied = false
  let splashHits = 0

  const primaryPos = applyDirectDamage(state, targetId, dmg, attacker.side)
  if (primaryPos.applied > 0) {
    primaryDamage = primaryPos.applied
    primaryDied = primaryPos.died
    pushDamageEvent(state, primaryPos.pos, primaryPos.applied, primaryPos.kind)
  }

  if (splashRadius > 0 && primaryPos.pos) {
    const center = primaryPos.pos
    for (const u of state.units) {
      if (u.id === targetId) continue
      if (u.side === attacker.side) continue
      if (u.hp <= 0) continue
      if (dist(u.pos, center) <= splashRadius) {
        const taken = takeDamageOnUnit(u, dmg)
        splashHits++
        pushDamageEvent(state, u.pos, taken, 'normal')
      }
    }
  }

  return { primaryDamage, primaryDied, splashHits }
}

/**
 * Apply spell damage centered at `pos` with `radius` to all enemies of `casterSide`.
 * Lightning has max_targets=3, applied to the 3 highest-HP enemies in radius.
 */
export function applySpell(
  state: MatchState,
  cardId: CrCardId,
  level: number,
  casterSide: Side,
  pos: Vec2,
): { hits: number; totalDamage: number } {
  const card = CR_CARDS_BY_ID[cardId]
  if (!card || card.card_type !== 'spell') return { hits: 0, totalDamage: 0 }

  const stats = scaleStatsForLevel(card.base_stats, level)
  const dmg = stats.dmg ?? 0
  const radius = card.base_stats.radius ?? 0
  const maxTargets = card.base_stats.max_targets ?? Infinity
  const enemySide: Side = casterSide === 'player' ? 'enemy' : 'player'

  // Collect candidate targets (units + active towers within radius).
  type Candidate = { kind: 'unit'; u: Unit } | { kind: 'tower'; id: string }
  const candidates: Candidate[] = []

  for (const u of state.units) {
    if (u.side !== enemySide) continue
    if (u.hp <= 0) continue
    if (dist(u.pos, pos) <= radius) candidates.push({ kind: 'unit', u })
  }
  for (const t of state.towers) {
    if (t.side !== enemySide) continue
    if (t.hp <= 0) continue
    if (dist(t.pos, pos) <= radius) candidates.push({ kind: 'tower', id: t.id })
  }

  // For Lightning, prefer high-HP targets (towers + tanks); for Arrows, hit everyone in radius.
  if (Number.isFinite(maxTargets)) {
    candidates.sort((a, b) => {
      const aHp = a.kind === 'unit' ? a.u.hp : (state.towers.find((t) => t.id === a.id)?.hp ?? 0)
      const bHp = b.kind === 'unit' ? b.u.hp : (state.towers.find((t) => t.id === b.id)?.hp ?? 0)
      return bHp - aHp
    })
  }
  const hitList = candidates.slice(0, Number.isFinite(maxTargets) ? maxTargets : candidates.length)

  let totalDamage = 0
  let hits = 0
  for (const c of hitList) {
    if (c.kind === 'unit') {
      const taken = takeDamageOnUnit(c.u, dmg)
      totalDamage += taken
      hits++
      pushDamageEvent(state, c.u.pos, taken, cardId === 'lightning' ? 'crit' : 'normal')
    } else {
      const tower = state.towers.find((t) => t.id === c.id)
      if (tower) {
        const taken = Math.min(tower.hp, dmg)
        tower.hp -= taken
        totalDamage += taken
        hits++
        pushDamageEvent(state, tower.pos, taken, 'tower')
      }
    }
  }

  return { hits, totalDamage }
}

interface DirectOutcome {
  applied: number
  died: boolean
  pos: Vec2 | null
  kind: 'normal' | 'tower'
}

function applyDirectDamage(
  state: MatchState,
  targetId: string,
  dmg: number,
  attackerSide: Side,
): DirectOutcome {
  if (isTowerId(targetId)) {
    const tower = state.towers.find((t) => t.id === targetId)
    if (!tower || tower.hp <= 0) return { applied: 0, died: false, pos: null, kind: 'tower' }
    const taken = Math.min(tower.hp, dmg)
    tower.hp -= taken
    // Hitting a king tower activates it; both side's princess hit also activates own king.
    if (tower.isKing) tower.isActive = true
    return { applied: taken, died: tower.hp <= 0, pos: tower.pos, kind: 'tower' }
  }

  const unit = state.units.find((u) => u.id === targetId)
  if (!unit || unit.hp <= 0 || unit.side === attackerSide) {
    return { applied: 0, died: false, pos: null, kind: 'normal' }
  }
  const taken = takeDamageOnUnit(unit, dmg)
  return { applied: taken, died: unit.hp <= 0, pos: unit.pos, kind: 'normal' }
}

function takeDamageOnUnit(unit: Unit, dmg: number): number {
  const taken = Math.min(unit.hp, dmg)
  unit.hp -= taken
  return taken
}

function pushDamageEvent(
  state: MatchState,
  pos: Vec2 | null,
  amount: number,
  kind: DamageEvent['kind'],
) {
  if (!pos || amount <= 0) return
  state.damageEvents.push({
    id: `d_${state.nextId++}`,
    pos: { ...pos },
    amount,
    kind,
    ttl: 0.7,
  })
}
