import { describe, it, expect } from 'vitest'
import { initMatch, applyAction } from '@/clash/engine/tick'
import { makeRng } from '@/clash/engine/rng'
import { ARENA } from '@/clash/lib/arena'
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

function freshState(seed = 42) {
  const rng = makeRng(seed)
  return {
    state: initMatch(
      {
        player: { cardIds: STARTER_DECK, levels: LEVELS_1 },
        enemy: { cardIds: STARTER_DECK, levels: LEVELS_1 },
        difficulty: 'normal',
        seed,
      },
      rng,
    ),
    rng,
    levels: { player: LEVELS_1, enemy: LEVELS_1 },
  }
}

describe('initMatch', () => {
  it('creates 6 towers', () => {
    const { state } = freshState()
    expect(state.towers).toHaveLength(6)
    expect(state.towers.filter((t) => t.isKing)).toHaveLength(2)
  })

  it('king towers start dormant; princess towers start active', () => {
    const { state } = freshState()
    const kings = state.towers.filter((t) => t.isKing)
    const princesses = state.towers.filter((t) => !t.isKing)
    expect(kings.every((k) => !k.isActive)).toBe(true)
    expect(princesses.every((p) => p.isActive)).toBe(true)
  })

  it('starts with 5 elixir on each side and empty units', () => {
    const { state } = freshState()
    expect(state.player.elixir.current).toBe(ARENA.elixirStart)
    expect(state.enemy.elixir.current).toBe(ARENA.elixirStart)
    expect(state.units).toHaveLength(0)
  })

  it('shuffles deck deterministically per seed', () => {
    const a = freshState(7).state
    const b = freshState(7).state
    expect(a.player.hand.pile).toEqual(b.player.hand.pile)
  })
})

describe('elixir regeneration', () => {
  it('adds ~1 elixir after ~2.8 seconds in main phase', () => {
    const { state, rng, levels } = freshState()
    applyAction(state, { kind: 'tick', dtSec: 2.8 }, rng, levels)
    expect(state.player.elixir.current).toBeGreaterThanOrEqual(6)
  })

  it('caps elixir at 10', () => {
    const { state, rng, levels } = freshState()
    applyAction(state, { kind: 'tick', dtSec: 60 }, rng, levels)
    expect(state.player.elixir.current).toBeLessThanOrEqual(ARENA.elixirMaxNormal)
  })

  it('overtime regenerates twice as fast', () => {
    const { state, rng, levels } = freshState()
    // Skip to overtime
    applyAction(state, { kind: 'tick', dtSec: ARENA.matchSeconds + 0.1 }, rng, levels)
    state.player.elixir.current = 0
    state.player.elixir.partial = 0
    applyAction(state, { kind: 'tick', dtSec: 1.4 }, rng, levels)
    expect(state.player.elixir.current).toBeGreaterThanOrEqual(1)
  })
})

describe('deploy actions', () => {
  it('spawns a troop and decrements elixir by cost', () => {
    const { state, rng, levels } = freshState()
    state.player.elixir.current = 10
    const handIndex = 0
    const cardId = state.player.hand.pile[handIndex]
    const COSTS: Record<string, number> = {
      knight: 3, archer: 3, goblin: 2, giant: 5,
      musketeer: 4, valkyrie: 4, cannon: 3, arrows: 3,
    }
    const expectedCost = COSTS[cardId] ?? 3

    applyAction(state, { kind: 'deploy', side: 'player', handIndex, pos: { x: 5, y: 5 } }, rng, levels)

    expect(state.player.elixir.current).toBe(10 - expectedCost)
    if (cardId !== 'arrows') {
      // Non-spell should spawn unit(s)
      expect(state.units.length).toBeGreaterThan(0)
    }
  })

  it('rejects deploy when not enough elixir', () => {
    const { state, rng, levels } = freshState()
    state.player.elixir.current = 1
    const initialUnitCount = state.units.length
    // Find a card costing > 1 in current hand
    const handIndex = state.player.hand.pile
      .slice(0, 4)
      .findIndex((id) => id && (id === 'giant' || id === 'musketeer'))
    if (handIndex === -1) return // skip if not possible this seed
    applyAction(state, { kind: 'deploy', side: 'player', handIndex, pos: { x: 5, y: 5 } }, rng, levels)
    expect(state.units).toHaveLength(initialUnitCount)
  })

  it('cycles hand: played card moves to back of pile', () => {
    const { state, rng, levels } = freshState()
    state.player.elixir.current = 10
    const playedCard = state.player.hand.pile[0]
    applyAction(state, { kind: 'deploy', side: 'player', handIndex: 0, pos: { x: 5, y: 5 } }, rng, levels)
    expect(state.player.hand.pile).toHaveLength(8)
    expect(state.player.hand.pile[7]).toBe(playedCard)
  })
})

describe('unit lifecycle', () => {
  it('spawned unit transitions from spawning to walking after freeze', () => {
    const { state, rng, levels } = freshState()
    state.player.elixir.current = 10
    // Find a non-spell to deploy
    const handIndex = state.player.hand.pile
      .slice(0, 4)
      .findIndex((id) => id !== 'arrows')
    applyAction(
      state,
      { kind: 'deploy', side: 'player', handIndex, pos: { x: 8, y: 5 } },
      rng,
      levels,
    )
    expect(state.units.every((u) => u.state === 'spawning')).toBe(true)

    applyAction(state, { kind: 'tick', dtSec: ARENA.spawnFreezeSec + 0.1 }, rng, levels)
    expect(state.units.every((u) => u.state !== 'spawning')).toBe(true)
  })
})

describe('end conditions', () => {
  it('result=win when enemy king HP reaches 0', () => {
    const { state, rng, levels } = freshState()
    const enemyKing = state.towers.find((t) => t.id === 'enemy_king')!
    enemyKing.hp = 0
    applyAction(state, { kind: 'tick', dtSec: 0.1 }, rng, levels)
    expect(state.result).toBe('win')
    expect(state.phase).toBe('ended')
  })

  it('result=loss when player king HP reaches 0', () => {
    const { state, rng, levels } = freshState()
    const playerKing = state.towers.find((t) => t.id === 'player_king')!
    playerKing.hp = 0
    applyAction(state, { kind: 'tick', dtSec: 0.1 }, rng, levels)
    expect(state.result).toBe('loss')
  })

  it('time expiration: more enemy towers lost = win', () => {
    const { state, rng, levels } = freshState()
    const enemyLeft = state.towers.find((t) => t.id === 'enemy_left')!
    enemyLeft.hp = 0
    state.elapsed = ARENA.matchSeconds + ARENA.overtimeSeconds
    applyAction(state, { kind: 'tick', dtSec: 0.5 }, rng, levels)
    expect(state.result).toBe('win')
  })

  it('time expiration with even towers + equal HP → draw', () => {
    const { state, rng, levels } = freshState()
    state.elapsed = ARENA.matchSeconds + ARENA.overtimeSeconds
    applyAction(state, { kind: 'tick', dtSec: 0.5 }, rng, levels)
    expect(state.result).toBe('draw')
  })
})

describe('tower behavior', () => {
  it('king tower activates when its princess falls', () => {
    const { state, rng, levels } = freshState()
    const enemyLeft = state.towers.find((t) => t.id === 'enemy_left')!
    const enemyKing = state.towers.find((t) => t.id === 'enemy_king')!
    enemyLeft.hp = 0
    applyAction(state, { kind: 'tick', dtSec: 0.1 }, rng, levels)
    expect(enemyKing.isActive).toBe(true)
  })
})
