import type { Card } from '@/types/db'
import type { BattleCard, BattleState } from '@/lib/battle/types'

// Mini card builder
export function mkCard(overrides: Partial<Card> & { id: string }): Card {
  return {
    id: overrides.id,
    name_zh: overrides.name_zh ?? overrides.id,
    name_en: overrides.name_en ?? overrides.id,
    rarity: overrides.rarity ?? 'common',
    base_attack: overrides.base_attack ?? 10,
    base_defense: overrides.base_defense ?? 10,
    ability_text_zh: null,
    ability_text_en: null,
    synergy_with: [],
    flavor_zh: null,
    flavor_en: null,
    ability_kind: overrides.ability_kind ?? null,
    ability_value: overrides.ability_value ?? 0,
    ability_trigger: overrides.ability_trigger ?? null,
  }
}

export function mkBattleCard(card: Card, star = 1): BattleCard {
  return {
    card,
    star_level: star,
    current_hp: 30,
    is_alive: true,
    is_played: false,
    active_buffs: [],
  }
}

// Common card prototypes
export const C_BASIC = mkCard({ id: 'basic', base_attack: 14, base_defense: 8 })
export const C_PIERCE = mkCard({ id: 'piercer', base_attack: 12, base_defense: 6, ability_kind: 'pierce', ability_trigger: 'on_attack' })
export const C_REFLECT = mkCard({ id: 'mirror', base_attack: 8, base_defense: 12, ability_kind: 'reflect', ability_value: 30, ability_trigger: 'on_defend' })
export const C_FIRST = mkCard({ id: 'sprinter', base_attack: 10, base_defense: 6, ability_kind: 'first_strike', ability_value: 5, ability_trigger: 'on_attack' })
export const C_SHIELD = mkCard({ id: 'shielder', base_attack: 6, base_defense: 10, ability_kind: 'shield', ability_value: 4, ability_trigger: 'on_play' })
export const C_HEAL = mkCard({ id: 'healer', base_attack: 8, base_defense: 8, ability_kind: 'heal', ability_value: 5, ability_trigger: 'on_battle_end' })
export const C_DMG = mkCard({ id: 'striker', base_attack: 14, base_defense: 6, ability_kind: 'damage_buff', ability_value: 3, ability_trigger: 'on_attack' })
export const C_PULSE = mkCard({ id: 'pulse', rarity: 'legendary', base_attack: 56, base_defense: 56, ability_kind: 'damage_buff', ability_value: 25, ability_trigger: 'passive' })
export const C_XP = mkCard({ id: 'xp_bringer', rarity: 'epic', base_attack: 32, base_defense: 24, ability_kind: 'xp_bonus', ability_value: 50, ability_trigger: 'on_battle_end' })

// Empty initial battle state with one card per side
export function mkState(opts?: Partial<BattleState>): BattleState {
  return {
    battle_id: 1,
    turn: 1,
    attacker_hp: 100,
    defender_hp: 100,
    attacker_cards: [mkBattleCard(C_BASIC)],
    defender_cards: [mkBattleCard(C_BASIC)],
    current_phase: 'pick_attacker',
    selected_attacker_id: null,
    log: [],
    passive_buffs: [],
    ...opts,
  }
}
