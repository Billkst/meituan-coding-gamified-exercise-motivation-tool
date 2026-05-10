import type { BattleState } from '@/lib/battle/types'

export function aiPickAttacker(state: BattleState): string {
  const candidates = state.defender_cards.filter(c => !c.is_played)
  if (candidates.length === 0) {
    throw new Error('aiPickAttacker: no unplayed cards')
  }
  return candidates
    .map(c => ({
      id: c.card.id,
      score:
        c.card.base_attack * (1 + 0.2 * (c.star_level - 1))
        + (c.card.ability_kind === 'first_strike' && state.turn <= 3 ? 8 : 0)
        + (c.card.ability_kind === 'pierce' ? 6 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0].id
}

export function aiPickTarget(state: BattleState, _attackerId: string): string {
  const candidates = state.attacker_cards.filter(c => !c.is_played)
  if (candidates.length === 0) {
    throw new Error('aiPickTarget: no unplayed cards')
  }
  return candidates
    .map(c => ({
      id: c.card.id,
      score: -c.card.base_defense + c.current_hp * 0.3,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0].id
}
