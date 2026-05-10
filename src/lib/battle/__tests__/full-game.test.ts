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
  let state = applyOnPlayTriggers(initial)
  for (let turn = 1; turn <= 8; turn++) {
    state = { ...state, turn }
    // player picks: attacker = first unplayed card on player side, target = any opponent card (defenders can be hit multiple times)
    const playerAttacker = state.attacker_cards.find(c => !c.is_played)!.card.id
    const playerTarget = state.defender_cards[0].card.id
    state = resolveAttack(state, 'attacker', playerAttacker, playerTarget)
    // ai picks
    const aiAtk = aiPickAttacker(state)
    const aiTgt = aiPickTarget(state, aiAtk)
    state = resolveAttack(state, 'defender', aiAtk, aiTgt)
  }
  return state
}

describe('full game smoke', () => {
  it('runs 8 turns with all-common decks, log length = 16 (8 player + 8 AI)', () => {
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
    expect(final.log).toHaveLength(16)
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
