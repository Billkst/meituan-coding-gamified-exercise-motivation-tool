import { describe, it, expect } from 'vitest'
import { applyAttack, applySpell } from '@/clash/engine/damage'
import { initMatch } from '@/clash/engine/tick'
import { spawnUnits } from '@/clash/engine/unit'
import { makeRng } from '@/clash/engine/rng'
import type { CrCardId } from '@/clash/lib/cardData'

const STARTER_DECK: CrCardId[] = [
  'knight',
  'archer',
  'goblin',
  'arrows',
  'cannon',
  'giant',
  'musketeer',
  'valkyrie',
]

const LEVELS_1 = STARTER_DECK.reduce(
  (acc, id) => ({ ...acc, [id]: 1 }),
  {} as Record<CrCardId, number>,
)

function freshState() {
  const rng = makeRng(42)
  return initMatch(
    {
      player: { cardIds: STARTER_DECK, levels: LEVELS_1 },
      enemy: { cardIds: STARTER_DECK, levels: LEVELS_1 },
      difficulty: 'normal',
      seed: 42,
    },
    rng,
  )
}

describe('applyAttack — single target', () => {
  it('reduces target HP by attacker dmg', () => {
    const state = freshState()
    const [attacker] = spawnUnits({
      cardId: 'knight',
      side: 'player',
      pos: { x: 5, y: 5 },
      level: 1,
      startId: 100,
    })
    const [defender] = spawnUnits({
      cardId: 'archer',
      side: 'enemy',
      pos: { x: 5, y: 6 },
      level: 1,
      startId: 200,
    })
    state.units.push(attacker, defender)
    const out = applyAttack(state, attacker, defender.id)
    expect(out.primaryDamage).toBe(150) // knight base dmg
    expect(defender.hp).toBe(250 - 150)
  })

  it('deals damage to a tower target and activates king if king', () => {
    const state = freshState()
    const [attacker] = spawnUnits({
      cardId: 'mini_pekka',
      side: 'player',
      pos: { x: 8.5, y: 28 },
      level: 1,
      startId: 100,
    })
    state.units.push(attacker)
    applyAttack(state, attacker, 'enemy_king')
    const enemyKing = state.towers.find((t) => t.id === 'enemy_king')!
    expect(enemyKing.hp).toBe(4000 - 600)
    expect(enemyKing.isActive).toBe(true)
  })
})

describe('applyAttack — splash (Valkyrie)', () => {
  it('hits multiple enemies in splash radius', () => {
    const state = freshState()
    const [valk] = spawnUnits({
      cardId: 'valkyrie',
      side: 'player',
      pos: { x: 5, y: 5 },
      level: 1,
      startId: 100,
    })
    const enemies = spawnUnits({
      cardId: 'goblin',
      side: 'enemy',
      pos: { x: 5, y: 5.5 },
      level: 1,
      startId: 200,
    })
    state.units.push(valk, ...enemies)
    const out = applyAttack(state, valk, enemies[0].id)
    // Goblin hp 200, dmg 230 → primary dmg capped at target's HP (no overkill counted)
    expect(out.primaryDamage).toBe(200)
    expect(out.splashHits).toBeGreaterThanOrEqual(1)
    // All 3 goblins should be dead (200 hp each, 230 dmg)
    expect(enemies.every((e) => e.hp <= 0)).toBe(true)
  })

  it('does not hit own side in splash', () => {
    const state = freshState()
    const [valk] = spawnUnits({
      cardId: 'valkyrie',
      side: 'player',
      pos: { x: 5, y: 5 },
      level: 1,
      startId: 100,
    })
    const [enemy] = spawnUnits({
      cardId: 'archer',
      side: 'enemy',
      pos: { x: 5, y: 5.5 },
      level: 1,
      startId: 200,
    })
    const friendlies = spawnUnits({
      cardId: 'goblin',
      side: 'player',
      pos: { x: 5, y: 5.3 },
      level: 1,
      startId: 300,
    })
    state.units.push(valk, enemy, ...friendlies)
    applyAttack(state, valk, enemy.id)
    expect(friendlies.every((f) => f.hp === 200)).toBe(true)
  })
})

describe('applySpell', () => {
  it('Arrows hits all enemies in radius (away from towers)', () => {
    const state = freshState()
    // Position chosen so no enemy tower falls inside radius 4.
    const center = { x: 9, y: 18 }
    const enemies = [
      ...spawnUnits({
        cardId: 'goblin',
        side: 'enemy',
        pos: { x: 9, y: 18 },
        level: 1,
        startId: 100,
      }),
      ...spawnUnits({
        cardId: 'archer',
        side: 'enemy',
        pos: { x: 10, y: 18 },
        level: 1,
        startId: 200,
      }),
    ]
    state.units.push(...enemies)
    const out = applySpell(state, 'arrows', 1, 'player', center)
    expect(out.hits).toBe(enemies.length)
    expect(out.totalDamage).toBeGreaterThan(0)
    expect(enemies.every((e) => e.hp <= 0)).toBe(true)
  })

  it('Lightning hits at most 3 highest-HP targets', () => {
    const state = freshState()
    const giants = spawnUnits({
      cardId: 'goblin',
      side: 'enemy',
      pos: { x: 5, y: 25 },
      level: 1,
      startId: 100,
    })
    state.units.push(...giants)
    // Add 3 archers to ensure > 3 targets
    const archers = [
      ...spawnUnits({
        cardId: 'archer',
        side: 'enemy',
        pos: { x: 5.5, y: 25 },
        level: 1,
        startId: 200,
      }),
      ...spawnUnits({
        cardId: 'archer',
        side: 'enemy',
        pos: { x: 6, y: 25 },
        level: 1,
        startId: 300,
      }),
    ]
    state.units.push(...archers)
    const out = applySpell(state, 'lightning', 1, 'player', { x: 5.5, y: 25 })
    expect(out.hits).toBeLessThanOrEqual(3)
  })

  it('Lightning does not hit own side', () => {
    const state = freshState()
    // Position friendlies in player half (no enemy tower in radius 3).
    const friendlies = spawnUnits({
      cardId: 'goblin',
      side: 'player',
      pos: { x: 9, y: 8 },
      level: 1,
      startId: 100,
    })
    state.units.push(...friendlies)
    const out = applySpell(state, 'lightning', 1, 'player', { x: 9, y: 8 })
    expect(out.hits).toBe(0)
    expect(friendlies.every((f) => f.hp === 200)).toBe(true)
  })
})
