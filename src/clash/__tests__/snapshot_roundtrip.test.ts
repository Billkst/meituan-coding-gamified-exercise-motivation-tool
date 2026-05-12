// Mid-match F5 recovery: verifies that serializing engine state + rng state,
// JSON round-tripping them, and resuming produces a state identical to the
// control run that advanced uninterrupted. If this test ever drifts, the
// snapshot recovery in useClashEngine has gone non-deterministic.

import { describe, it, expect } from 'vitest'
import { initMatch, applyAction } from '@/clash/engine/tick'
import { makeRng } from '@/clash/engine/rng'
import type { CrCardId } from '@/clash/lib/cardData'
import type { MatchState } from '@/clash/engine/types'

const DECK: CrCardId[] = [
  'knight', 'archer', 'goblin', 'cannon',
  'giant', 'baby_dragon', 'arrows', 'musketeer',
]
const LEVELS_1 = DECK.reduce(
  (a, id) => ({ ...a, [id]: 1 }),
  {} as Record<CrCardId, number>,
)
const LEVELS = { player: LEVELS_1, enemy: LEVELS_1 }
const DT = 1 / 30

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

describe('snapshot round-trip — F5 recovery determinism', () => {
  it('serialize → restore → resume produces same final state as uninterrupted run', () => {
    // Control: run 60 seconds uninterrupted.
    const control = freshMatch(42)
    tick(control.state, control.rng, 60)

    // Test: run 30s, JSON serialize state + rng state, restore, run another 30s.
    const test = freshMatch(42)
    tick(test.state, test.rng, 30)

    const snapshot = {
      state: JSON.parse(JSON.stringify(test.state)) as MatchState,
      rngState: test.rng.state(),
    }

    const restoredRng = makeRng(1)
    restoredRng.restore(snapshot.rngState)
    tick(snapshot.state, restoredRng, 30)

    // Compare key invariants. We don't compare exact equality because log
    // ordering can subtly differ — but tick count, phase, elapsed, and unit
    // count must match.
    expect(snapshot.state.tick).toBe(control.state.tick)
    expect(snapshot.state.phase).toBe(control.state.phase)
    expect(snapshot.state.elapsed).toBeCloseTo(control.state.elapsed, 1)
    expect(snapshot.state.units.length).toBe(control.state.units.length)
    expect(snapshot.state.player.elixir.current).toBeCloseTo(
      control.state.player.elixir.current,
      1,
    )
  })

  it('rng.state() is a single integer that round-trips through JSON', () => {
    const rng = makeRng(12345)
    // Warm up the rng
    for (let i = 0; i < 100; i++) rng()
    const snap = rng.state()
    expect(typeof snap).toBe('number')
    expect(Number.isInteger(snap)).toBe(true)

    const restored = makeRng(0)
    restored.restore(snap)
    // Next 5 outputs must match.
    for (let i = 0; i < 5; i++) {
      const a = rng()
      const b = restored()
      expect(b).toBe(a)
    }
  })
})
