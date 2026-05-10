import { describe, it, expect } from 'vitest'
import { nextWaypoint, stepToward, defaultMarchTarget } from '@/clash/engine/pathfinding'
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
