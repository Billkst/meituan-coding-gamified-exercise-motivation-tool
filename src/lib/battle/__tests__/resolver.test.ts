import { describe, it, expect } from 'vitest'
import { resolveAttack, effectiveDefense } from '@/lib/battle/resolver'
import {
  mkCard, mkBattleCard, mkState,
  C_BASIC, C_PIERCE, C_REFLECT, C_FIRST, C_SHIELD, C_HEAL, C_DMG, C_PULSE, C_XP,
} from './fixtures'

describe('resolveAttack', () => {
  it('basic ATK 14 vs DEF 8 = 6 damage', () => {
    const s = mkState()
    const after = resolveAttack(s, 'attacker', 'basic', 'basic')
    expect(after.log[0].actual_damage).toBe(6)
    expect(after.defender_hp).toBe(94)
  })

  it('star level multiplier: ATK 20 ★3 = 28 then -8 DEF = 20', () => {
    const s = mkState({
      attacker_cards: [mkBattleCard(mkCard({ id: 'a', base_attack: 20, base_defense: 0 }), 3)],
      defender_cards: [mkBattleCard(mkCard({ id: 'd', base_attack: 0, base_defense: 8 }))],
    })
    const after = resolveAttack(s, 'attacker', 'a', 'd')
    expect(after.log[0].raw_damage).toBe(28)
    expect(after.log[0].actual_damage).toBe(20)
  })

  it('pierce ignores DEF', () => {
    const s = mkState({
      attacker_cards: [mkBattleCard(C_PIERCE)],
      defender_cards: [mkBattleCard(mkCard({ id: 'wall', base_attack: 0, base_defense: 50 }))],
    })
    const after = resolveAttack(s, 'attacker', 'piercer', 'wall')
    expect(after.log[0].actual_damage).toBe(12)  // full 12 ATK
  })

  it('reflect 30% bounces back to attacker', () => {
    const s = mkState({
      attacker_cards: [mkBattleCard(mkCard({ id: 'a', base_attack: 20, base_defense: 0 }))],
      defender_cards: [mkBattleCard(C_REFLECT)],
    })
    // raw=20, def=12 → actual=8, reflect 30% of 8 = 2.4 → round to 2
    const after = resolveAttack(s, 'attacker', 'a', 'mirror')
    expect(after.defender_hp).toBe(92)  // 100 - 8
    expect(after.attacker_hp).toBe(98)  // 100 - 2
  })

  it('first_strike +5 ATK only when turn ≤ 3', () => {
    const earlyState = mkState({ turn: 2, attacker_cards: [mkBattleCard(C_FIRST)] })
    const earlyAfter = resolveAttack(earlyState, 'attacker', 'sprinter', 'basic')
    // raw = 10 + 5 = 15, def 8 → actual 7
    expect(earlyAfter.log[0].actual_damage).toBe(7)

    const lateState = mkState({ turn: 4, attacker_cards: [mkBattleCard(C_FIRST)] })
    const lateAfter = resolveAttack(lateState, 'attacker', 'sprinter', 'basic')
    // raw = 10 (no +5), def 8 → actual 2
    expect(lateAfter.log[0].actual_damage).toBe(2)
  })

  it('shield buff increases effectiveDefense for whole battle', () => {
    const card = mkBattleCard(C_BASIC)
    card.active_buffs = [
      { source_card_id: 'shielder', kind: 'shield', value: 4, expires_after_turn: -1 },
    ]
    const s = mkState({ defender_cards: [card] })
    expect(effectiveDefense(card, s, 'defender')).toBe(12)  // 8 + 4
    const after = resolveAttack(s, 'attacker', 'basic', 'basic')
    expect(after.log[0].actual_damage).toBe(2)  // 14 - 12
  })

  it('damage_buff on_attack adds absolute damage', () => {
    const s = mkState({ attacker_cards: [mkBattleCard(C_DMG)] })
    const after = resolveAttack(s, 'attacker', 'striker', 'basic')
    // raw = 14 + 3 = 17, def 8 → actual 9
    expect(after.log[0].actual_damage).toBe(9)
  })

  it('damage_buff passive (PULSE +25%) applies to all attacker damage', () => {
    const s = mkState({
      attacker_cards: [mkBattleCard(C_BASIC), mkBattleCard(C_PULSE)],
      passive_buffs: [
        { source_card_id: 'pulse', kind: 'damage_buff', value: 25, expires_after_turn: -1 },
      ],
    })
    const after = resolveAttack(s, 'attacker', 'basic', 'basic')
    // raw = 14 * 1.25 = 17.5 → round 18, def 8 → actual 10
    expect(after.log[0].raw_damage).toBe(18)
    expect(after.log[0].actual_damage).toBe(10)
  })

  it('floor: damage capped at min 1', () => {
    const s = mkState({
      attacker_cards: [mkBattleCard(mkCard({ id: 'weak', base_attack: 1, base_defense: 0 }))],
      defender_cards: [mkBattleCard(mkCard({ id: 'tank', base_attack: 0, base_defense: 50 }))],
    })
    const after = resolveAttack(s, 'attacker', 'weak', 'tank')
    expect(after.log[0].actual_damage).toBe(1)
  })

  it('multi-buff stacking: damage_buff (passive +25%) + on_attack +3 + first_strike +5', () => {
    const card = mkBattleCard(mkCard({
      id: 'super', base_attack: 10, base_defense: 0,
      ability_kind: 'first_strike', ability_value: 5, ability_trigger: 'on_attack',
    }))
    const s = mkState({
      turn: 1,
      attacker_cards: [card],
      passive_buffs: [
        { source_card_id: 'pulse', kind: 'damage_buff', value: 25, expires_after_turn: -1 },
      ],
    })
    // first_strike (turn=1) +5 → 15, then passive +25% → 18.75 → round 19, def 8 → actual 11
    const after = resolveAttack(s, 'attacker', 'super', 'basic')
    expect(after.log[0].raw_damage).toBe(19)
    expect(after.log[0].actual_damage).toBe(11)
  })

  it('xp_bonus on_battle_end does NOT affect damage', () => {
    const s = mkState({ attacker_cards: [mkBattleCard(C_XP)] })
    // base atk 32, def 8 → actual 24 (no xp_bonus damage interference)
    const after = resolveAttack(s, 'attacker', 'xp_bringer', 'basic')
    expect(after.log[0].actual_damage).toBe(24)
  })

  it('log entry contains triggers_fired for reflect', () => {
    const s = mkState({
      attacker_cards: [mkBattleCard(mkCard({ id: 'a', base_attack: 20, base_defense: 0 }))],
      defender_cards: [mkBattleCard(C_REFLECT)],
    })
    const after = resolveAttack(s, 'attacker', 'a', 'mirror')
    const triggerKinds = after.log[0].triggers_fired.map(t => t.kind)
    expect(triggerKinds).toContain('reflect')
  })
})
