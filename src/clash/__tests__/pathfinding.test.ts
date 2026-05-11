import { describe, it, expect } from 'vitest'
import { nextWaypoint, stepToward, defaultMarchTarget } from '@/clash/engine/pathfinding'
import { ARENA, isInRiver } from '@/clash/lib/arena'
import type { Unit } from '@/clash/engine/types'

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u_1',
    side: 'player',
    cardId: 'knight',
    pos: { x: 5, y: 5 },
    hp: 1500,
    maxHp: 1500,
    state: 'walking',
    stateTimer: 0,
    attackCooldown: 0,
    stats: {
      hp: 1500,
      dmg: 150,
      hitSpeed: 1.2,
      moveSpeed: 60,
      range: 1,
      target: 'ground',
      splashRadius: 0,
    },
    targetId: null,
    lane: 'left',
    isBuilding: false,
    isAir: false,
    ...overrides,
  }
}

describe('nextWaypoint', () => {
  it('returns target directly when no river crossing', () => {
    const unit = makeUnit({ pos: { x: 5, y: 5 } })
    const wp = nextWaypoint(unit, { x: 5, y: 10 })
    expect(wp).toEqual({ x: 5, y: 10 })
  })

  it('routes ground unit to bridge when crossing northbound', () => {
    const unit = makeUnit({ pos: { x: 5, y: 10 }, lane: 'left' })
    const wp = nextWaypoint(unit, { x: 5, y: 27 })
    // Should aim at south end of bridge (left bridge x=3)
    expect(wp.x).toBe(3)
    expect(wp.y).toBeLessThan(15)
  })

  it('routes ground unit to right bridge when on right side', () => {
    const unit = makeUnit({ pos: { x: 12, y: 10 }, lane: 'right' })
    const wp = nextWaypoint(unit, { x: 14, y: 27 })
    expect(wp.x).toBe(14)
  })

  it('air unit ignores river and goes straight', () => {
    const unit = makeUnit({
      pos: { x: 5, y: 10 },
      isAir: true,
      cardId: 'baby_dragon',
    })
    const wp = nextWaypoint(unit, { x: 5, y: 27 })
    expect(wp).toEqual({ x: 5, y: 27 })
  })

  it('building unit gets target as-is (never moves anyway)', () => {
    const unit = makeUnit({ isBuilding: true, cardId: 'cannon' })
    const wp = nextWaypoint(unit, { x: 5, y: 27 })
    expect(wp).toEqual({ x: 5, y: 27 })
  })
})

describe('stepToward', () => {
  it('moves the unit toward target by moveSpeed × dt (tiles/min → tiles/sec)', () => {
    const unit = makeUnit({
      pos: { x: 0, y: 0 },
      stats: { ...makeUnit().stats, moveSpeed: 60 }, // 60 tiles/min = 1 tile/sec
    })
    const next = stepToward(unit, { x: 0, y: 5 }, 1.0) // 1 second
    expect(next.x).toBeCloseTo(0, 4)
    expect(next.y).toBeCloseTo(1, 4)
  })

  it('does not overshoot — clamps to target distance', () => {
    const unit = makeUnit({
      pos: { x: 0, y: 0 },
      stats: { ...makeUnit().stats, moveSpeed: 600 }, // very fast
    })
    const next = stepToward(unit, { x: 0, y: 0.5 }, 1.0)
    expect(next.y).toBeCloseTo(0.5, 4)
  })

  it('returns same pos when not in walking state', () => {
    const unit = makeUnit({ pos: { x: 5, y: 5 }, state: 'spawning' })
    const next = stepToward(unit, { x: 10, y: 10 }, 1.0)
    expect(next).toEqual({ x: 5, y: 5 })
  })

  it('buildings never move', () => {
    const unit = makeUnit({ pos: { x: 5, y: 5 }, isBuilding: true })
    const next = stepToward(unit, { x: 10, y: 10 }, 5.0)
    expect(next).toEqual({ x: 5, y: 5 })
  })
})

describe('defaultMarchTarget', () => {
  it('player left lane → enemy left princess', () => {
    const unit = makeUnit({ side: 'player', lane: 'left' })
    const target = defaultMarchTarget(unit)
    expect(target.x).toBe(3)
    expect(target.y).toBeGreaterThan(15)
  })

  it('player right lane → enemy right princess', () => {
    const unit = makeUnit({ side: 'player', lane: 'right' })
    const target = defaultMarchTarget(unit)
    expect(target.x).toBe(14)
  })

  it('enemy side picks player towers', () => {
    const unit = makeUnit({ side: 'enemy', lane: 'left' })
    const target = defaultMarchTarget(unit)
    expect(target.x).toBe(3)
    expect(target.y).toBeLessThan(10)
  })
})

// =============================================================================
// Day 21 — Bridge crossing regression tests (5+ cases)
// Reproduces the P0 bug: ground unit cannot cross the river.
// Iron Rule: regression tests required even before fix lands.
// =============================================================================

/**
 * Helper — advance a unit toward defaultMarchTarget for a deterministic
 * number of tile-second steps. Returns final position + whether unit ever
 * entered the river band.
 */
function simulateMarchUntilNorthOfRiver(
  unit: Unit,
  maxSteps = 100,
): { pos: { x: number; y: number }; everInRiver: boolean; reachedNorth: boolean } {
  let pos = { ...unit.pos }
  let everInRiver = false
  const target = defaultMarchTarget(unit)
  for (let i = 0; i < maxSteps; i++) {
    const cur = { ...unit, pos }
    const wp = nextWaypoint(cur, target)
    pos = stepToward(cur, wp, 1.0) // 1 second / step
    if (isInRiver(pos.y)) everInRiver = true
    if (pos.y > ARENA.river.yMax + 0.5) break
  }
  const reachedNorth = pos.y > ARENA.river.yMax
  return { pos, everInRiver, reachedNorth }
}

function simulateMarchUntilSouthOfRiver(
  unit: Unit,
  maxSteps = 100,
): { pos: { x: number; y: number }; everInRiver: boolean; reachedSouth: boolean } {
  let pos = { ...unit.pos }
  let everInRiver = false
  const target = defaultMarchTarget(unit)
  for (let i = 0; i < maxSteps; i++) {
    const cur = { ...unit, pos }
    const wp = nextWaypoint(cur, target)
    pos = stepToward(cur, wp, 1.0)
    if (isInRiver(pos.y)) everInRiver = true
    if (pos.y < ARENA.river.yMin - 0.5) break
  }
  const reachedSouth = pos.y < ARENA.river.yMin
  return { pos, everInRiver, reachedSouth }
}

describe('bridge crossing — Day 21 regression', () => {
  it('left lane player ground unit at (3, 10) crosses bridge and reaches north side', () => {
    const unit = makeUnit({
      side: 'player',
      lane: 'left',
      pos: { x: 3, y: 10 },
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const { pos, reachedNorth } = simulateMarchUntilNorthOfRiver(unit, 50)
    expect(reachedNorth).toBe(true)
    expect(pos.y).toBeGreaterThan(ARENA.river.yMax)
  })

  it('right lane player ground unit at (14, 10) crosses right bridge', () => {
    const unit = makeUnit({
      side: 'player',
      lane: 'right',
      pos: { x: 14, y: 10 },
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const { pos, reachedNorth } = simulateMarchUntilNorthOfRiver(unit, 50)
    expect(reachedNorth).toBe(true)
    // Should have crossed via right bridge (x=14), not left
    expect(pos.x).toBeCloseTo(14, 0)
  })

  it('center-positioned ground unit at (8.5, 10) commits to a bridge (tie-break)', () => {
    const unit = makeUnit({
      side: 'player',
      lane: 'left', // unit.ts assigns left for x<9
      pos: { x: 8.5, y: 10 },
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const { pos, reachedNorth } = simulateMarchUntilNorthOfRiver(unit, 80)
    expect(reachedNorth).toBe(true)
    // Should have committed to one of the two bridges
    expect([3, 14]).toContain(Math.round(pos.x))
  })

  it('enemy southbound ground unit at (3, 22) reaches player side', () => {
    const unit = makeUnit({
      side: 'enemy',
      lane: 'left',
      pos: { x: 3, y: 22 },
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const { pos, reachedSouth } = simulateMarchUntilSouthOfRiver(unit, 50)
    expect(reachedSouth).toBe(true)
    expect(pos.y).toBeLessThan(ARENA.river.yMin)
  })

  it('unit already in river continues to exit (does not stall)', () => {
    const unit = makeUnit({
      side: 'player',
      lane: 'left',
      pos: { x: 3, y: 16 }, // already in river band
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const target = defaultMarchTarget(unit)
    const wp = nextWaypoint(unit, target)
    // Should target a point past the north exit (not loop in place)
    expect(wp.y).toBeGreaterThan(ARENA.river.yMax)
  })

  it('air unit (baby_dragon) takes diagonal path, no bridge detour', () => {
    const unit = makeUnit({
      pos: { x: 5, y: 10 },
      lane: 'left',
      isAir: true,
      cardId: 'baby_dragon',
      stats: { ...makeUnit().stats, moveSpeed: 90 },
    })
    const wp = nextWaypoint(unit, { x: 5, y: 27 })
    // Air ignores bridges — waypoint matches target directly
    expect(wp).toEqual({ x: 5, y: 27 })
  })

  it('unit at south bridge edge (3, 14.5) advances past river — does NOT loop', () => {
    // This is the precise bug repro: unit reaches BRIDGE_SOUTH_Y and old logic
    // would keep returning the same waypoint, stalling forever.
    const unit = makeUnit({
      side: 'player',
      lane: 'left',
      pos: { x: 3, y: 14.5 },
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const target = defaultMarchTarget(unit) // enemy_left at (3, 27)
    const wp = nextWaypoint(unit, target)
    // The next waypoint MUST be north of the south bridge edge,
    // otherwise unit is stuck.
    expect(wp.y).toBeGreaterThan(14.5)
  })

  it('ground unit at (5, 10) routes through nearest bridge (left x=3, not center)', () => {
    const unit = makeUnit({
      side: 'player',
      lane: 'left',
      pos: { x: 5, y: 10 },
      stats: { ...makeUnit().stats, moveSpeed: 60 },
    })
    const target = defaultMarchTarget(unit)
    const wp = nextWaypoint(unit, target)
    // 5 is closer to bridge x=3 than x=14
    expect(wp.x).toBe(3)
    expect(wp.y).toBeLessThan(ARENA.river.yMin) // approaching from south
  })
})
