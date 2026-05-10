import { describe, it, expect } from 'vitest'
import { aiPickAttacker, aiPickTarget } from '@/lib/battle/ai'
import { mkState, mkBattleCard, mkCard, C_FIRST, C_PIERCE } from './fixtures'

describe('aiPickAttacker', () => {
  it('picks highest base_attack × star multiplier', () => {
    const s = mkState({
      defender_cards: [
        mkBattleCard(mkCard({ id: 'low', base_attack: 8 })),
        mkBattleCard(mkCard({ id: 'high', base_attack: 20 })),
      ],
    })
    expect(aiPickAttacker(s)).toBe('high')
  })

  it('first_strike at turn ≤ 3 gets +8 score bonus', () => {
    const s = mkState({
      turn: 2,
      defender_cards: [
        mkBattleCard(mkCard({ id: 'plain', base_attack: 12 })),
        mkBattleCard(C_FIRST),  // base 10, first_strike
      ],
    })
    // plain score = 12, first score = 10 + 8 = 18 → first wins
    expect(aiPickAttacker(s)).toBe('sprinter')
  })

  it('pierce gets +6 score bonus', () => {
    const s = mkState({
      defender_cards: [
        mkBattleCard(mkCard({ id: 'plain', base_attack: 14 })),
        mkBattleCard(C_PIERCE),  // base 12, pierce
      ],
    })
    // plain = 14, pierce = 12 + 6 = 18 → pierce wins
    expect(aiPickAttacker(s)).toBe('piercer')
  })

  it('skips already-played cards', () => {
    const big = mkBattleCard(mkCard({ id: 'big', base_attack: 50 }))
    big.is_played = true
    const s = mkState({
      defender_cards: [big, mkBattleCard(mkCard({ id: 'small', base_attack: 5 }))],
    })
    expect(aiPickAttacker(s)).toBe('small')
  })

  it('ties broken by id alphabetical (deterministic)', () => {
    const s = mkState({
      defender_cards: [
        mkBattleCard(mkCard({ id: 'zebra', base_attack: 10 })),
        mkBattleCard(mkCard({ id: 'alpha', base_attack: 10 })),
      ],
    })
    expect(aiPickAttacker(s)).toBe('alpha')
  })
})

describe('aiPickTarget', () => {
  it('picks lowest DEF target', () => {
    const s = mkState({
      attacker_cards: [
        mkBattleCard(mkCard({ id: 'glass', base_defense: 4 })),
        mkBattleCard(mkCard({ id: 'tank', base_defense: 20 })),
      ],
    })
    expect(aiPickTarget(s, 'anything')).toBe('glass')
  })
})
