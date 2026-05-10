// Pathfinding for ground + air units. No A* — straight line, with bridge detour for ground.

import { ARENA, isInRiver, nearestBridgeX } from '@/clash/lib/arena'
import type { Unit, Vec2 } from './types'

const BRIDGE_NORTH_Y = ARENA.river.yMax + 0.5
const BRIDGE_SOUTH_Y = ARENA.river.yMin - 0.5

/**
 * Compute the next sub-target a unit should walk toward this tick.
 * For air units this is just `targetPos`.
 * For ground units crossing the river, returns the appropriate bridge endpoint.
 */
export function nextWaypoint(unit: Unit, targetPos: Vec2): Vec2 {
  if (unit.isAir || unit.isBuilding) return targetPos

  const fromY = unit.pos.y
  const toY = targetPos.y
  const crossingNorthbound = fromY < ARENA.river.yMin && toY > ARENA.river.yMax
  const crossingSouthbound = fromY > ARENA.river.yMax && toY < ARENA.river.yMin
  const inRiver = isInRiver(fromY)

  if (!crossingNorthbound && !crossingSouthbound && !inRiver) {
    return targetPos
  }

  // Pick the bridge nearer to the unit's lane (or current x).
  const bridgeX = nearestBridgeX(unit.pos.x)

  if (inRiver) {
    // Already on bridge — step toward exit.
    const exitY = fromY < (ARENA.river.yMin + ARENA.river.yMax) / 2
      ? BRIDGE_SOUTH_Y
      : BRIDGE_NORTH_Y
    return { x: bridgeX, y: toY > fromY ? BRIDGE_NORTH_Y + 0.2 : exitY }
  }

  // Approach the bridge from this side.
  if (crossingNorthbound) {
    return { x: bridgeX, y: BRIDGE_SOUTH_Y }
  }
  return { x: bridgeX, y: BRIDGE_NORTH_Y }
}

/**
 * Compute next position for a moving unit toward the supplied waypoint
 * within `dtSec` seconds, using moveSpeed (tiles/min) → tiles/sec.
 *
 * Buildings never move. Spawning/dying units don't move. Returns the
 * unit's existing pos in those cases.
 */
export function stepToward(unit: Unit, waypoint: Vec2, dtSec: number): Vec2 {
  if (unit.isBuilding) return unit.pos
  if (unit.state !== 'walking') return unit.pos

  const dx = waypoint.x - unit.pos.x
  const dy = waypoint.y - unit.pos.y
  const distLeft = Math.sqrt(dx * dx + dy * dy)
  if (distLeft < 1e-3) return unit.pos

  // moveSpeed is tiles per minute (Clash Royale convention).
  const tilesPerSec = unit.stats.moveSpeed / 60
  const stepLen = Math.min(distLeft, tilesPerSec * dtSec)
  return {
    x: unit.pos.x + (dx / distLeft) * stepLen,
    y: unit.pos.y + (dy / distLeft) * stepLen,
  }
}

/**
 * Pick a default fallback target position when a unit has no chosen targetId
 * (e.g. no enemies on field). Routes toward the closer enemy princess tower
 * by lane; falls back to enemy king if both princesses are down.
 */
export function defaultMarchTarget(unit: Unit): Vec2 {
  const t = ARENA.towers
  const pick = (def: { x: number; y: number }): Vec2 => ({ x: def.x, y: def.y })
  if (unit.side === 'player') {
    if (unit.lane === 'left') return pick(t.enemy_left)
    if (unit.lane === 'right') return pick(t.enemy_right)
    return pick(t.enemy_king)
  }
  if (unit.lane === 'left') return pick(t.player_left)
  if (unit.lane === 'right') return pick(t.player_right)
  return pick(t.player_king)
}
