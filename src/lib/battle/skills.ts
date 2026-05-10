import type { BattleState, Buff, Side } from '@/lib/battle/types'

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 } as const

export function applyOnPlayTriggers(state: BattleState): BattleState {
  const next: BattleState = JSON.parse(JSON.stringify(state))

  for (const side of ['attacker', 'defender'] as Side[]) {
    const cards = side === 'attacker' ? next.attacker_cards : next.defender_cards
    const sorted = [...cards].sort((a, b) =>
      RARITY_ORDER[a.card.rarity] - RARITY_ORDER[b.card.rarity]
      || b.star_level - a.star_level
      || a.card.id.localeCompare(b.card.id)
    )

    for (const c of sorted) {
      if (c.card.ability_trigger === 'on_play' && c.card.ability_kind === 'shield') {
        // give all friends +value DEF buff (whole battle)
        const buff: Buff = {
          source_card_id: c.card.id,
          kind: 'shield',
          value: c.card.ability_value,
          expires_after_turn: -1,
        }
        for (const friend of cards) {
          friend.active_buffs.push({ ...buff })
        }
      }
    }
  }

  // also scan for passive damage_buff and add to passive_buffs
  for (const side of ['attacker', 'defender'] as Side[]) {
    const cards = side === 'attacker' ? next.attacker_cards : next.defender_cards
    for (const c of cards) {
      if (c.card.ability_trigger === 'passive' && c.card.ability_kind === 'damage_buff') {
        next.passive_buffs.push({
          source_card_id: c.card.id,
          kind: 'damage_buff',
          value: c.card.ability_value,
          expires_after_turn: -1,
        })
      }
    }
  }

  return next
}

export function computeXpBonusPercent(state: BattleState, side: Side): number {
  const cards = side === 'attacker' ? state.attacker_cards : state.defender_cards
  let pct = 0
  for (const c of cards) {
    if (c.card.ability_trigger === 'on_battle_end' && c.card.ability_kind === 'xp_bonus') {
      pct += c.card.ability_value
    }
  }
  return pct
}

export function computeHealAtBattleEnd(state: BattleState, side: Side): number {
  const cards = side === 'attacker' ? state.attacker_cards : state.defender_cards
  let heal = 0
  for (const c of cards) {
    if (c.card.ability_trigger === 'on_battle_end' && c.card.ability_kind === 'heal') {
      heal += c.card.ability_value
    }
  }
  return heal
}
