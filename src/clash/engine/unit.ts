// Unit spawn + stat resolution. Stateless utilities used by tick reducer.

import { CR_CARDS_BY_ID, scaleStatsForLevel } from '@/clash/lib/cardData'
import type { CrCardDef, CrCardId } from '@/clash/lib/cardData'
import { ARENA, type Side } from '@/clash/lib/arena'
import type { ResolvedStats, Unit, Vec2 } from './types'

/**
 * Compute final per-unit stats for a card at a level, including level scaling
 * and per-card splash radius (Valkyrie 1.2, Baby Dragon 0.5 mini-splash).
 */
export function resolveStats(card: CrCardDef, level: number): ResolvedStats {
  const scaled = scaleStatsForLevel(card.base_stats, level)
  // splash heuristic: range < 2 implies melee; valkyrie's 1.2 means small AOE.
  const splashRadius =
    card.id === 'valkyrie' ? 1.2 : card.id === 'baby_dragon' ? 0.5 : 0
  return {
    hp: scaled.hp ?? 1,
    dmg: scaled.dmg ?? 0,
    hitSpeed: scaled.hit_speed ?? 1.0,
    moveSpeed: scaled.move_speed ?? 0,
    range: scaled.range ?? 1,
    target: scaled.target ?? 'ground',
    splashRadius,
  }
}

/** Air units (currently only baby_dragon) bypass the river. */
export function isAirCard(cardId: CrCardId): boolean {
  return cardId === 'baby_dragon'
}

/** Card ids that produce buildings (immobile units). */
export function isBuildingCard(cardId: CrCardId): boolean {
  const card = CR_CARDS_BY_ID[cardId]
  return card?.card_type === 'building'
}

/**
 * Lay out N units around a center position (small triangle / cluster).
 * Used because some cards spawn 2-3 instances.
 */
export function clusterPositions(center: Vec2, count: number): Vec2[] {
  if (count === 1) return [center]
  if (count === 2) {
    return [
      { x: center.x - 0.5, y: center.y },
      { x: center.x + 0.5, y: center.y },
    ]
  }
  // 3 in a triangle
  return [
    { x: center.x, y: center.y + 0.5 },
    { x: center.x - 0.5, y: center.y - 0.4 },
    { x: center.x + 0.5, y: center.y - 0.4 },
  ]
}

export interface SpawnInput {
  cardId: CrCardId
  side: Side
  pos: Vec2
  level: number
  startId: number
}

/**
 * Produce a set of Units for a card deployment. Returns an empty array for spell cards
 * (spells are resolved immediately by damage.ts and never become units).
 */
export function spawnUnits(input: SpawnInput): Unit[] {
  const card = CR_CARDS_BY_ID[input.cardId]
  if (!card) return []
  if (card.card_type === 'spell') return []

  const stats = resolveStats(card, input.level)
  const count = card.base_stats.count ?? 1
  const positions = clusterPositions(input.pos, count)
  const isAir = isAirCard(input.cardId)
  const isBuilding = isBuildingCard(input.cardId)

  return positions.map((pos, i) => ({
    id: `u_${input.startId + i}`,
    side: input.side,
    cardId: input.cardId,
    pos,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'spawning',
    stateTimer: ARENA.spawnFreezeSec,
    attackCooldown: 0,
    stats,
    targetId: null,
    lane: pos.x < 9 ? 'left' : 'right',
    isBuilding,
    isAir,
  }))
}

/** Distance between two points (logical units). */
export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}
