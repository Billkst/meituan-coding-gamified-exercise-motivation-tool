// Whole-match engine simulation tests.
//
// Purpose: pin "the engine doesn't hang" and "units behave sanely across a
// 3-minute run". Each test scripts deploys + advances time in fixed dtSec
// chunks via the same applyAction path the RAF loop uses, then asserts on
// the final state.
//
// These are pure engine tests — no DOM, no Pixi, no Supabase.

import { describe, it, expect } from 'vitest'
import { initMatch, applyAction } from '@/clash/engine/tick'
import { makeRng } from '@/clash/engine/rng'
import { ARENA } from '@/clash/lib/arena'
import type { CrCardId } from '@/clash/lib/cardData'
import type { MatchState } from '@/clash/engine/types'

const DECK: CrCardId[] = [
  'knight',
  'archer',
  'goblin',
  'arrows',
  'cannon',
  'giant',
  'musketeer',
  'valkyrie',
]
const LEVELS_1 = DECK.reduce(
  (a, id) => ({ ...a, [id]: 1 }),
  {} as Record<CrCardId, number>,
)
const LEVELS = { player: LEVELS_1, enemy: LEVELS_1 }
const DT = 1 / 30 // 30 Hz engine step

function freshMatch(seed = 7) {
  const rng = makeRng(seed)
  const state = initMatch(
    {
      player: { cardIds: DECK, levels: LEVELS_1 },
      enemy: { cardIds: DECK, levels: LEVELS_1 },
      difficulty: 'normal',
      seed,
    },
    rng,
  )
  return { state, rng }
}

function tick(state: MatchState, rng: () => number, seconds: number) {
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) {
    applyAction(state, { kind: 'tick', dtSec: DT }, rng, LEVELS)
  }
}

function deployByCardId(
  state: MatchState,
  rng: () => number,
  side: 'player' | 'enemy',
  cardId: CrCardId,
  pos: { x: number; y: number },
): boolean {
  const hand = side === 'player' ? state.player.hand : state.enemy.hand
  let idx = hand.pile.findIndex((c) => c === cardId)
  if (idx < 0) return false
  // If the card got shuffled out of the active 4-card window, swap it into
  // slot 0 so the engine accepts the deploy. Test-only convenience.
  if (idx > 3) {
    const tmp = hand.pile[0]
    hand.pile[0] = cardId
    hand.pile[idx] = tmp
    idx = 0
  }
  applyAction(state, { kind: 'deploy', side, handIndex: idx, pos }, rng, LEVELS)
  return true
}

function noNaNPositions(state: MatchState): boolean {
  return state.units.every(
    (u) => Number.isFinite(u.pos.x) && Number.isFinite(u.pos.y),
  )
}

describe('match E2E — engine doesn\'t hang', () => {
  it('advances elapsed monotonically across a full 3-minute simulation', () => {
    const { state, rng } = freshMatch()
    const samples: number[] = []
    for (let s = 0; s < 200; s++) {
      tick(state, rng, 1)
      samples.push(state.elapsed)
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1])
    }
  })

  it('phase ends after matchSeconds + overtimeSeconds', () => {
    const { state, rng } = freshMatch()
    tick(state, rng, ARENA.matchSeconds + ARENA.overtimeSeconds + 1)
    expect(state.phase).toBe('ended')
    expect(state.result).not.toBeNull()
  })

  it('never produces NaN/Infinity unit positions over 500 ticks with deploys', () => {
    const { state, rng } = freshMatch()
    // Spawn a handful of units on both sides at various positions
    deployByCardId(state, rng, 'player', 'knight', { x: 3, y: 10 })
    tick(state, rng, 2)
    deployByCardId(state, rng, 'enemy', 'knight', { x: 14, y: 22 })
    tick(state, rng, 2)
    deployByCardId(state, rng, 'player', 'archer', { x: 14, y: 10 })
    tick(state, rng, 2)
    deployByCardId(state, rng, 'enemy', 'goblin', { x: 3, y: 22 })

    for (let s = 0; s < 30; s++) {
      tick(state, rng, 0.5)
      expect(noNaNPositions(state)).toBe(true)
    }
  })

  it('cleans up dead units (no zombie corpses lingering past deathFadeSec)', () => {
    const { state, rng } = freshMatch()
    deployByCardId(state, rng, 'player', 'knight', { x: 3, y: 10 })
    tick(state, rng, 1) // pass spawn freeze
    const player = state.units.find((u) => u.side === 'player' && u.cardId === 'knight')!
    player.hp = 0
    tick(state, rng, ARENA.deathFadeSec + 1)
    expect(state.units.find((u) => u.id === player.id)).toBeUndefined()
  })
})

describe('match E2E — lane discipline', () => {
  it('a left-lane knight does not aggro a far-back right-lane cannon', () => {
    const { state, rng } = freshMatch()
    // Player deploys knight at left lane near own princess.
    deployByCardId(state, rng, 'player', 'knight', { x: 3, y: 10 })
    // Enemy deploys cannon at the right back corner.
    deployByCardId(state, rng, 'enemy', 'cannon', { x: 15, y: 25 })
    // Advance 10 seconds — knight has time to march, but not enough to cross
    // the river under move_speed=60 (tiles/min ≈ 1 tile/sec).
    tick(state, rng, 10)
    const knight = state.units.find((u) => u.side === 'player' && u.cardId === 'knight')!
    // Knight should still be in the left half of the field; cross-lane drift
    // would put it close to x=14.
    expect(knight.pos.x).toBeLessThan(8)
    // Knight's target must not be the far-corner cannon.
    expect(knight.targetId).not.toBe(
      state.units.find((u) => u.side === 'enemy' && u.cardId === 'cannon')!.id,
    )
  })

  it('two opposing units in the same lane do engage', () => {
    const { state, rng } = freshMatch()
    deployByCardId(state, rng, 'player', 'knight', { x: 3, y: 13 })
    deployByCardId(state, rng, 'enemy', 'knight', { x: 3, y: 19 })
    tick(state, rng, 30) // long enough for both to cross + meet
    const playerKnight = state.units.find(
      (u) => u.side === 'player' && u.cardId === 'knight',
    )
    const enemyKnight = state.units.find(
      (u) => u.side === 'enemy' && u.cardId === 'knight',
    )
    // At least one of them should have engaged or killed the other.
    const engaged = (playerKnight?.targetId ?? null) !== null ||
      (enemyKnight?.targetId ?? null) !== null ||
      !playerKnight ||
      !enemyKnight
    expect(engaged).toBe(true)
  })

  it('giant ignores troops and walks straight at a tower', () => {
    const { state, rng } = freshMatch()
    // Give player enough elixir to deploy giant (cost 5).
    state.player.elixir.current = 10
    deployByCardId(state, rng, 'player', 'giant', { x: 3, y: 10 })
    // Drop an enemy archer right in the giant's path.
    deployByCardId(state, rng, 'enemy', 'archer', { x: 3, y: 13 })
    tick(state, rng, 20)
    const giant = state.units.find((u) => u.side === 'player' && u.cardId === 'giant')
    if (!giant) return // killed; nothing to assert
    // Giant's target (if any) must be a building/tower, never a troop.
    if (giant.targetId) {
      const isTowerOrBuilding =
        giant.targetId.startsWith('enemy_') ||
        state.units.find((u) => u.id === giant.targetId)?.isBuilding === true
      expect(isTowerOrBuilding).toBe(true)
    }
  })
})

describe('match E2E — end conditions', () => {
  it('phase=ended and result=win when enemy king HP drops to 0', () => {
    const { state, rng } = freshMatch()
    const enemyKing = state.towers.find((t) => t.id === 'enemy_king')!
    enemyKing.isActive = true
    enemyKing.hp = 1
    deployByCardId(state, rng, 'player', 'knight', { x: 8.5, y: 14 })
    // Walk the knight to the king and let it chip.
    enemyKing.hp = 0 // shortcut — equivalent to "king destroyed this tick"
    tick(state, rng, 0.5)
    expect(state.phase).toBe('ended')
    expect(state.result).toBe('win')
  })

  it('phase=ended and result=loss when player king HP drops to 0', () => {
    const { state, rng } = freshMatch()
    const playerKing = state.towers.find((t) => t.id === 'player_king')!
    playerKing.hp = 0
    tick(state, rng, 0.5)
    expect(state.phase).toBe('ended')
    expect(state.result).toBe('loss')
  })
})
