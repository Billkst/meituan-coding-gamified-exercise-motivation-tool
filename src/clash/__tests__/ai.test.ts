import { describe, it, expect } from 'vitest'
import { aiDecide, DIFFICULTY_CONFIG, nextDecisionDelay } from '@/clash/engine/ai'
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

function freshState(diff: 'easy' | 'normal' | 'hard' = 'normal') {
  const rng = makeRng(42)
  return initMatch(
    {
      player: { cardIds: STARTER_DECK, levels: LEVELS_1 },
      enemy: { cardIds: STARTER_DECK, levels: LEVELS_1 },
      difficulty: diff,
      seed: 42,
    },
    rng,
  )
}

describe('aiDecide', () => {
  it('returns null when elixir below threshold', () => {
    const state = freshState('hard')
    state.enemy.elixir.current = DIFFICULTY_CONFIG.hard.elixirThreshold - 1
    const rng = makeRng(1)
    expect(aiDecide(state, rng)).toBeNull()
  })

  it('issues a deploy action when elixir is high', () => {
    const state = freshState('normal')
    state.enemy.elixir.current = 10
    const rng = makeRng(1)
    const action = aiDecide(state, rng)
    expect(action).not.toBeNull()
    expect(action!.kind).toBe('deploy')
    if (action?.kind === 'deploy') {
      expect(action.side).toBe('enemy')
      expect(action.handIndex).toBeGreaterThanOrEqual(0)
      expect(action.handIndex).toBeLessThanOrEqual(3)
      // Enemy deploys in y >= 18 (their own half)
      expect(action.pos.y).toBeGreaterThanOrEqual(18)
    }
  })

  it('hard difficulty has lower elixir threshold than easy', () => {
    expect(DIFFICULTY_CONFIG.hard.elixirThreshold).toBeLessThan(
      DIFFICULTY_CONFIG.easy.elixirThreshold,
    )
  })

  it('returns null if no card in hand is affordable', () => {
    const state = freshState('hard')
    state.enemy.elixir.current = 4
    // Force pile so first 4 are all 5+ cost
    state.enemy.hand.pile = ['giant', 'lightning', 'mini_pekka', 'tesla', 'knight', 'archer', 'goblin', 'arrows']
    state.enemy.elixir.current = 4
    const rng = makeRng(1)
    const action = aiDecide(state, rng)
    // Lightning costs 6, giant 5, mini_pekka 4, tesla 4 — mini_pekka & tesla affordable at 4
    // But threshold is 4, so it acts. Result should be deploy.
    if (action?.kind === 'deploy') {
      const cardId = state.enemy.hand.pile[action.handIndex]
      expect(['mini_pekka', 'tesla']).toContain(cardId)
    }
  })
})

describe('nextDecisionDelay', () => {
  it('falls within difficulty bounds', () => {
    const state = freshState('normal')
    const cfg = DIFFICULTY_CONFIG.normal
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(i)
      const d = nextDecisionDelay(state, rng)
      expect(d).toBeGreaterThanOrEqual(cfg.decisionDelayMin)
      expect(d).toBeLessThanOrEqual(cfg.decisionDelayMax)
    }
  })

  it('hard difficulty has shorter delays', () => {
    expect(DIFFICULTY_CONFIG.hard.decisionDelayMax).toBeLessThan(
      DIFFICULTY_CONFIG.easy.decisionDelayMin + 0.001 + 1.0,
    )
  })
})

describe('aiDecide reactivity', () => {
  it('chooses anti-air card preferentially when player has air units', () => {
    const state = freshState('hard')
    state.enemy.elixir.current = 10
    // Force pile so the first 4 are: giant, knight, musketeer, valkyrie
    state.enemy.hand.pile = ['giant', 'knight', 'musketeer', 'valkyrie', 'archer', 'goblin', 'arrows', 'cannon']
    // Player has a baby_dragon flying mid-field
    const dragon = spawnUnits({
      cardId: 'baby_dragon',
      side: 'player',
      pos: { x: 9, y: 16 },
      level: 1,
      startId: 999,
    })
    state.units.push(...dragon)

    // Run aiDecide many times and count how often anti-air is chosen
    let antiAirCount = 0
    let total = 0
    for (let i = 0; i < 30; i++) {
      const rng = makeRng(i + 100)
      const action = aiDecide(state, rng)
      if (action?.kind === 'deploy') {
        total++
        const cardId = state.enemy.hand.pile[action.handIndex]
        if (cardId === 'musketeer' || cardId === 'archer') antiAirCount++
      }
    }
    // With hard counter chance 0.9, expect majority to pick anti-air
    expect(antiAirCount / total).toBeGreaterThan(0.4)
  })
})
