import { describe, it, expect } from 'vitest'
import { previewDamage } from '@/lib/battle/simulator'
import { mkBattleCard, mkState, C_BASIC, C_PIERCE, C_SHIELD } from './fixtures'

describe('previewDamage', () => {
  it('returns positive damage for basic attack and does not mutate state', () => {
    const state = mkState({
      attacker_cards: [mkBattleCard(C_BASIC)],
      defender_cards: [mkBattleCard(C_BASIC)],
    })
    const snapshot = JSON.stringify(state)
    const p = previewDamage(state, C_BASIC.id, C_BASIC.id)
    expect(p.actualDamage).toBeGreaterThan(0)
    expect(p.rawDamage).toBeGreaterThanOrEqual(p.actualDamage)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('captures pierce trigger when attacker has pierce', () => {
    const state = mkState({
      attacker_cards: [mkBattleCard(C_PIERCE)],
      defender_cards: [mkBattleCard(C_BASIC)],
    })
    const p = previewDamage(state, C_PIERCE.id, C_BASIC.id)
    expect(p.triggers.some(t => t.kind === 'pierce')).toBe(true)
    // pierce ignores DEF → actual = raw
    expect(p.actualDamage).toBe(p.rawDamage)
  })

  it('shielded target takes less damage than unshielded', () => {
    const shielded = mkBattleCard(C_SHIELD)
    shielded.active_buffs.push({
      source_card_id: 'src',
      kind: 'shield',
      value: 10,
      expires_after_turn: -1,
    })
    const state = mkState({
      attacker_cards: [mkBattleCard(C_BASIC)],
      defender_cards: [shielded, mkBattleCard(C_BASIC)],
    })
    const pShielded = previewDamage(state, C_BASIC.id, C_SHIELD.id)
    const pUnshielded = previewDamage(state, C_BASIC.id, C_BASIC.id)
    expect(pShielded.actualDamage).toBeLessThan(pUnshielded.actualDamage)
  })
})
