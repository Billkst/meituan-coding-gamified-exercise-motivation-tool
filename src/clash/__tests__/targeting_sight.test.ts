// Sight-range regression tests.
//
// Bug origin: pickTarget returned the closest enemy on the *entire* field,
// so a knight walking the left lane would aggro a cannon dropped in the
// far back of the right lane and walk diagonally across the river.
//
// These tests pin the new behavior — units only consider targets within
// their sight cone.

import { describe, it, expect } from 'vitest'
import { pickTarget, sightRangeFor } from '@/clash/engine/targeting'
import type { MatchState, Unit } from '@/clash/engine/types'

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: overrides.id ?? 'u_1',
    side: overrides.side ?? 'player',
    cardId: overrides.cardId ?? 'knight',
    pos: overrides.pos ?? { x: 4, y: 10 },
    hp: overrides.hp ?? 1500,
    maxHp: overrides.maxHp ?? 1500,
    state: overrides.state ?? 'walking',
    stateTimer: overrides.stateTimer ?? 0,
    attackCooldown: overrides.attackCooldown ?? 0,
    stats: overrides.stats ?? {
      hp: 1500,
      dmg: 150,
      hitSpeed: 1.2,
      moveSpeed: 60,
      range: 1,
      target: 'ground',
      splashRadius: 0,
    },
    targetId: overrides.targetId ?? null,
    lane: overrides.lane ?? 'left',
    isBuilding: overrides.isBuilding ?? false,
    isAir: overrides.isAir ?? false,
  }
}

function emptyState(): MatchState {
  return {
    tick: 0,
    elapsed: 0,
    phase: 'main',
    units: [],
    towers: [],
    player: { hand: { pile: [] }, elixir: { current: 5, partial: 0 }, towersLost: 0 },
    enemy: { hand: { pile: [] }, elixir: { current: 5, partial: 0 }, towersLost: 0 },
    damageEvents: [],
    log: [],
    result: null,
    difficulty: 'normal',
    nextId: 1,
  }
}

describe('sightRangeFor', () => {
  it('melee troops get the floor sight (5.5)', () => {
    const knight = makeUnit({ stats: { ...makeUnit().stats, range: 1 } })
    expect(sightRangeFor(knight)).toBeCloseTo(5.5)
  })

  it('ranged troops get range + 3', () => {
    const musketeer = makeUnit({ stats: { ...makeUnit().stats, range: 6 } })
    expect(sightRangeFor(musketeer)).toBeCloseTo(9)
  })

  it('buildings see exactly their attack range', () => {
    const cannon = makeUnit({
      isBuilding: true,
      stats: { ...makeUnit().stats, range: 6 },
    })
    expect(sightRangeFor(cannon)).toBeCloseTo(6)
  })
})

describe('pickTarget — sight cone', () => {
  it('ignores a cross-lane enemy beyond sight', () => {
    // Player knight in left lane at (4, 10); enemy cannon in right back at (15, 25).
    // Distance ≈ √(11² + 15²) ≈ 18.6 — well outside knight's 5.5-tile sight.
    const state = emptyState()
    const knight = makeUnit({
      id: 'knight',
      side: 'player',
      pos: { x: 4, y: 10 },
      lane: 'left',
    })
    const enemyCannon = makeUnit({
      id: 'enemy_cannon',
      side: 'enemy',
      pos: { x: 15, y: 25 },
      isBuilding: true,
      stats: { ...knight.stats, range: 6 },
    })
    state.units = [knight, enemyCannon]
    expect(pickTarget(state, knight)).toBeNull()
  })

  it('targets an in-sight enemy unit on the same lane', () => {
    const state = emptyState()
    const knight = makeUnit({
      id: 'knight',
      side: 'player',
      pos: { x: 4, y: 10 },
    })
    const enemyGoblin = makeUnit({
      id: 'enemy_goblin',
      side: 'enemy',
      pos: { x: 4, y: 13 }, // distance 3 — well within sight
      cardId: 'goblin',
    })
    state.units = [knight, enemyGoblin]
    expect(pickTarget(state, knight)).toBe('enemy_goblin')
  })

  it('drops stale target once it walks outside the sight cone', () => {
    const state = emptyState()
    const knight = makeUnit({
      id: 'knight',
      side: 'player',
      pos: { x: 4, y: 10 },
      targetId: 'enemy_runner',
    })
    const enemyRunner = makeUnit({
      id: 'enemy_runner',
      side: 'enemy',
      pos: { x: 14, y: 12 }, // distance 10.2 — out of sight
    })
    state.units = [knight, enemyRunner]
    expect(pickTarget(state, knight)).toBeNull()
  })

  it('a building does not target a troop beyond its attack range', () => {
    const state = emptyState()
    const cannon = makeUnit({
      id: 'cannon',
      side: 'player',
      pos: { x: 5, y: 8 },
      isBuilding: true,
      stats: {
        hp: 700,
        dmg: 110,
        hitSpeed: 1.0,
        moveSpeed: 0,
        range: 6,
        target: 'ground',
        splashRadius: 0,
      },
    })
    const farTroop = makeUnit({
      id: 'far_troop',
      side: 'enemy',
      pos: { x: 14, y: 8 }, // distance 9 > range 6
    })
    state.units = [cannon, farTroop]
    expect(pickTarget(state, cannon)).toBeNull()
  })

  it('a building targets a troop inside its attack range', () => {
    const state = emptyState()
    const cannon = makeUnit({
      id: 'cannon',
      side: 'player',
      pos: { x: 5, y: 8 },
      isBuilding: true,
      stats: {
        hp: 700,
        dmg: 110,
        hitSpeed: 1.0,
        moveSpeed: 0,
        range: 6,
        target: 'ground',
        splashRadius: 0,
      },
    })
    const closeTroop = makeUnit({
      id: 'close',
      side: 'enemy',
      pos: { x: 5, y: 12 }, // distance 4 < range 6
    })
    state.units = [cannon, closeTroop]
    expect(pickTarget(state, cannon)).toBe('close')
  })

  it('giant ignores troops and walks until a building/tower comes into sight', () => {
    const state = emptyState()
    const giant = makeUnit({
      id: 'giant',
      side: 'player',
      cardId: 'giant',
      pos: { x: 4, y: 10 },
      stats: {
        hp: 3500,
        dmg: 200,
        hitSpeed: 1.5,
        moveSpeed: 45,
        range: 1,
        target: 'building',
        splashRadius: 0,
      },
    })
    const enemyArcher = makeUnit({
      id: 'enemy_archer',
      side: 'enemy',
      pos: { x: 5, y: 11 }, // distance 1.4 — close, but Giant ignores troops
    })
    state.units = [giant, enemyArcher]
    expect(pickTarget(state, giant)).toBeNull()
  })

  it('keeps the existing target when it is still in sight (anti-jitter)', () => {
    const state = emptyState()
    const knight = makeUnit({
      id: 'knight',
      side: 'player',
      pos: { x: 4, y: 10 },
      targetId: 'first_goblin',
    })
    const firstGoblin = makeUnit({
      id: 'first_goblin',
      side: 'enemy',
      pos: { x: 4, y: 12 }, // distance 2
    })
    const closerGoblin = makeUnit({
      id: 'closer_goblin',
      side: 'enemy',
      pos: { x: 4, y: 11 }, // distance 1 — closer
    })
    state.units = [knight, firstGoblin, closerGoblin]
    // Anti-jitter keeps the current target even though closer_goblin is nearer.
    expect(pickTarget(state, knight)).toBe('first_goblin')
  })
})
