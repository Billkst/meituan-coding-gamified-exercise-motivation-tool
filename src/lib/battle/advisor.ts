import type { OwnedCard } from '@/api/cards'
import type { Rarity } from '@/types/db'
import type { BattleState } from './types'
import { previewDamage } from './simulator'

const RARITY_BONUS: Record<Rarity, number> = {
  common: 0, rare: 5, epic: 12, legendary: 25,
}

// ============================================================
// In-battle next-move recommendation
// ============================================================

export interface NextMoveRec {
  phase: 'pick_attacker' | 'pick_target' | 'none'
  attacker_id: string | null
  target_id: string | null
  expected_damage: number | null
}

const NONE: NextMoveRec = {
  phase: 'none',
  attacker_id: null,
  target_id: null,
  expected_damage: null,
}

// Recommend the next move based on the current battle state.
// pick_attacker → search all (atk, def) pairs for max damage; suggest the
// attacker side of the winning pair (target previewed but not enforced).
// pick_target → fix the already-selected attacker; pick the target it would
// hurt most. Falls back to 'none' when there's nothing to attack with.
export function recommendNextMove(state: BattleState): NextMoveRec {
  if (state.current_phase === 'pick_attacker') {
    const myUsable = state.attacker_cards.filter(c => !c.is_played && c.is_alive)
    if (myUsable.length === 0) return NONE

    let best = { atkId: '', defId: '', dmg: -1 }
    for (const a of myUsable) {
      for (const d of state.defender_cards) {
        if (!d.is_alive) continue
        const p = previewDamage(state, a.card.id, d.card.id)
        if (p.actualDamage > best.dmg) {
          best = { atkId: a.card.id, defId: d.card.id, dmg: p.actualDamage }
        }
      }
    }
    if (best.dmg < 0) return NONE
    return {
      phase: 'pick_attacker',
      attacker_id: best.atkId,
      target_id: best.defId,
      expected_damage: best.dmg,
    }
  }

  if (state.current_phase === 'pick_target' && state.selected_attacker_id) {
    let best = { defId: '', dmg: -1 }
    for (const d of state.defender_cards) {
      if (!d.is_alive) continue
      const p = previewDamage(state, state.selected_attacker_id, d.card.id)
      if (p.actualDamage > best.dmg) {
        best = { defId: d.card.id, dmg: p.actualDamage }
      }
    }
    if (best.dmg < 0) return NONE
    return {
      phase: 'pick_target',
      attacker_id: state.selected_attacker_id,
      target_id: best.defId,
      expected_damage: best.dmg,
    }
  }

  return NONE
}

// ============================================================
// Pre-battle deck composer (Day 5 — kept as-is)
// ============================================================

export interface RecommendResult {
  deck: string[]
  reasoning_zh: string
  reasoning_en: string
}

export function recommendDeck(myCards: OwnedCard[]): RecommendResult {
  const scored = myCards.map(oc => ({
    id: oc.card_id,
    owned: oc,
    score:
      (oc.card.base_attack + oc.card.base_defense)
      * (1 + 0.2 * (oc.star_level - 1))
      + RARITY_BONUS[oc.card.rarity]
      + oc.card.synergy_with.length * 1,
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const picked = scored.slice(0, 8)
  const deck = picked.map(s => s.id)
  return { deck, ...buildReasoning(picked.map(p => p.owned)) }
}

function buildReasoning(cards: OwnedCard[]): { reasoning_zh: string; reasoning_en: string } {
  const legendaryN = cards.filter(c => c.card.rarity === 'legendary').length
  const epicN = cards.filter(c => c.card.rarity === 'epic').length
  const synergyN = countSynergyChains(cards)
  const avgStar = cards.length > 0
    ? cards.reduce((s, c) => s + c.star_level, 0) / cards.length
    : 1

  const tier_zh = legendaryN > 0 || epicN >= 2 ? '高强度卡组' : '稳健卡组'
  const tier_en = legendaryN > 0 || epicN >= 2 ? 'High-tier' : 'Solid'

  const partsZh: string[] = []
  if (legendaryN > 0) partsZh.push(`legendary ×${legendaryN}`)
  if (epicN > 0) partsZh.push(`epic ×${epicN}`)
  partsZh.push(`协同链 ×${synergyN}`)
  partsZh.push(`平均 ★${avgStar.toFixed(1)}`)

  const partsEn: string[] = []
  if (legendaryN > 0) partsEn.push(`legendary ×${legendaryN}`)
  if (epicN > 0) partsEn.push(`epic ×${epicN}`)
  partsEn.push(`synergy ×${synergyN}`)
  partsEn.push(`avg ★${avgStar.toFixed(1)}`)

  return {
    reasoning_zh: `${tier_zh}：${partsZh.join(' · ')}`,
    reasoning_en: `${tier_en} deck: ${partsEn.join(' · ')}`,
  }
}

function countSynergyChains(cards: OwnedCard[]): number {
  const ids = new Set(cards.map(c => c.card_id))
  let chains = 0
  for (const c of cards) {
    if (c.card.synergy_with.some(syn => ids.has(syn))) chains += 1
  }
  return Math.floor(chains / 2)
}
