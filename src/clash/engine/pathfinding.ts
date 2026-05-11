// Pathfinding for ground + air units. No A* — straight line, with bridge detour for ground.

import { ARENA, isInRiver, nearestBridgeX } from '@/clash/lib/arena'
import type { Unit, Vec2 } from './types'

// South and north bridge entry/exit points (just outside the river band).
const BRIDGE_SOUTH_Y = ARENA.river.yMin - 0.5
const BRIDGE_NORTH_Y = ARENA.river.yMax + 0.5

// How close to the bridge column counts as "lined up to cross".
const BRIDGE_LANE_EPS = 0.4

/**
 * Compute the next sub-target a unit should walk toward this tick.
 *
 * Logic:
 *   - Air / building units ignore the river entirely (return target as-is).
 *   - If unit and target are on the same side of the river, return target.
 *   - Otherwise route via the nearest bridge column in two phases:
 *       Phase 1: approach the bridge entry (BRIDGE_SOUTH_Y or BRIDGE_NORTH_Y)
 *                from the unit's current side, walking laterally toward bridgeX.
 *       Phase 2: once on the bridge column, walk through the river to the far
 *                exit so the unit clears the band in subsequent ticks.
 *
 * The previous version had a stall bug: when fromY reached BRIDGE_SOUTH_Y
 * (= yMin - 0.5), `crossingNorthbound` was still true (14.5 < 15) and the
 * function returned (bridgeX, 14.5) — the same point. stepToward then refused
 * to move (distLeft < 1e-3), so the unit was pinned just south of the river
 * forever. Phase 2 in the new logic fixes this by aiming past the river once
 * the unit is aligned with the bridge column.
 */
export function nextWaypoint(unit: Unit, targetPos: Vec2): Vec2 {
  if (unit.isAir || unit.isBuilding) return targetPos

  const fromY = unit.pos.y
  const toY = targetPos.y
  const { yMin, yMax } = ARENA.river

  const fromNorth = fromY > yMax
  const fromSouth = fromY < yMin
  const fromInRiver = isInRiver(fromY)
  const targetNorth = toY > yMax
  const targetSouth = toY < yMin

  // Same side of the river — walk straight at the target.
  if ((fromNorth && targetNorth) || (fromSouth && targetSouth)) {
    return targetPos
  }

  const bridgeX = nearestBridgeX(unit.pos.x)
  const alignedWithBridge = Math.abs(unit.pos.x - bridgeX) <= BRIDGE_LANE_EPS

  // Unit currently in the river band — push toward the far exit.
  if (fromInRiver) {
    if (toY > fromY) return { x: bridgeX, y: BRIDGE_NORTH_Y }
    return { x: bridgeX, y: BRIDGE_SOUTH_Y }
  }

  // Northbound crossing (from south side, want to go north).
  if (fromSouth && targetNorth) {
    if (!alignedWithBridge) {
      // Phase 1: approach the bridge entry from the south side.
      return { x: bridgeX, y: BRIDGE_SOUTH_Y }
    }
    // Phase 2: lined up — push through the river to the north exit.
    return { x: bridgeX, y: BRIDGE_NORTH_Y }
  }

  // Southbound crossing (from north side, want to go south).
  if (fromNorth && targetSouth) {
    if (!alignedWithBridge) {
      return { x: bridgeX, y: BRIDGE_NORTH_Y }
    }
    return { x: bridgeX, y: BRIDGE_SOUTH_Y }
  }

  // Fallback (shouldn't reach here for ground units, but stay safe).
  return targetPos
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
