import { describe, it, expect } from 'vitest'
import { resolveAttack } from '@/lib/battle/resolver'
import { aiPickAttacker, aiPickTarget } from '@/lib/battle/ai'
import { applyOnPlayTriggers } from '@/lib/battle/skills'
import type { BattleState, BattleCard } from '@/lib/battle/types'
import { mkBattleCard, mkCard, C_PULSE } from './fixtures'

function mkDeck(prefix: string, n = 8): BattleCard[] {
  const out: BattleCard[] = []
  for (let i = 0; i < n; i++) {
    out.push(mkBattleCard(mkCard({ id: `${prefix}${i}`, base_attack: 10, base_defense: 8 })))
  }
  return out
}

function runFullGame(initial: BattleState): BattleState {
  // resolver marks BOTH attacker and defender is_played each call.
  // With 8 cards per side, 4 rounds × (1 player attack + 1 AI attack) = 8 attacks
  // consume all 16 card slots: each card appears exactly once (as attacker or target).
  // Round k: player p[2k] → n[2k], AI n[2k+1] → p[2k+1].
  let state = applyOnPlayTriggers(initial)

  for (let turn = 1; turn <= 4; turn++) {
    state = { ...state, turn }

    // player attack: first unplayed attacker vs first unplayed defender
    const pAtk = state.attacker_cards.find(c => !c.is_played)!
    const pTgt = state.defender_cards.find(c => !c.is_played)!
    state = resolveAttack(state, 'attacker', pAtk.card.id, pTgt.card.id)

    // ai attack: next unplayed defender as attacker vs next unplayed attacker as target
    const aiAtk = state.defender_cards.find(c => !c.is_played)!
    const aiTgt = state.attacker_cards.find(c => !c.is_played)!
    state = resolveAttack(state, 'defender', aiAtk.card.id, aiTgt.card.id)
  }
  return state
}

describe('full game smoke', () => {
  it('runs 4 rounds with all-common decks, log length = 8 (4 player + 4 AI), all cards played', () => {
    const initial: BattleState = {
      battle_id: 1,
      turn: 1,
      attacker_hp: 100,
      defender_hp: 100,
      attacker_cards: mkDeck('p'),
      defender_cards: mkDeck('n'),
      current_phase: 'pick_attacker',
      selected_attacker_id: null,
      log: [],
      passive_buffs: [],
    }
    const final = runFullGame(initial)
    expect(final.log).toHaveLength(8)
    expect(final.attacker_cards.every(c => c.is_played)).toBe(true)
    expect(final.defender_cards.every(c => c.is_played)).toBe(true)
  })

  it('PULSE-equipped player should reliably beat all-common AI', () => {
    const playerDeck = [
      mkBattleCard(C_PULSE, 1),
      ...mkDeck('p', 7),
    ]
    const initial: BattleState = {
      battle_id: 1,
      turn: 1,
      attacker_hp: 100,
      defender_hp: 100,
      attacker_cards: playerDeck,
      defender_cards: mkDeck('n'),
      current_phase: 'pick_attacker',
      selected_attacker_id: null,
      log: [],
      passive_buffs: [],
    }
    const final = runFullGame(initial)
    const atkRemaining = final.attacker_hp
    const defRemaining = final.defender_hp
    expect(atkRemaining).toBeGreaterThan(defRemaining)
    expect(atkRemaining - defRemaining).toBeGreaterThan(30)
  })
})
