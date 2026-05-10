import { describe, it, expect } from 'vitest'
import { recommendDeck, recommendNextMove } from '@/lib/battle/advisor'
import type { OwnedCard } from '@/api/cards'
import type { Card } from '@/types/db'
import { mkCard, mkBattleCard, mkState, C_BASIC, C_PIERCE, C_SHIELD } from './fixtures'

interface MkOwnedOpts {
  star_level?: number
  copies?: number
  card?: Partial<Card>
}

function mkOwnedCard(cardId: string, opts: MkOwnedOpts = {}): OwnedCard {
  return {
    id: 0,
    user_id: 'u',
    card_id: cardId,
    star_level: opts.star_level ?? 1,
    copies: opts.copies ?? 1,
    acquired_at: '2026-05-10T00:00:00Z',
    card: mkCard({ id: cardId, ...(opts.card ?? {}) }),
  }
}

describe('recommendDeck', () => {
  it('returns all when fewer than 8 cards owned', () => {
    const owned = [mkOwnedCard('a'), mkOwnedCard('b'), mkOwnedCard('c')]
    const r = recommendDeck(owned)
    expect(r.deck).toHaveLength(3)
  })

  it('prefers higher star levels', () => {
    const cards: OwnedCard[] = []
    // 9 commons, last one is ★5
    for (let i = 0; i < 9; i++) {
      cards.push(mkOwnedCard(`c${i}`, { star_level: i === 8 ? 5 : 1 }))
    }
    const r = recommendDeck(cards)
    expect(r.deck).toContain('c8')  // ★5 must be in top 8
  })

  it('rarity bonus pulls in legendary even with low ATK/DEF', () => {
    const cards: OwnedCard[] = []
    // 8 strong commons + 1 weak legendary
    for (let i = 0; i < 8; i++) {
      cards.push(mkOwnedCard(`c${i}`, { card: { id: `c${i}`, base_attack: 50, base_defense: 50, rarity: 'common' } }))
    }
    cards.push(mkOwnedCard('leg', { card: { id: 'leg', base_attack: 5, base_defense: 5, rarity: 'legendary' } }))
    const r = recommendDeck(cards)
    // legendary score = (5+5)*1 + 25 = 35; common = 100; commons win → leg NOT in deck
    expect(r.deck).not.toContain('leg')
    // sanity: reasoning string non-empty
    expect(r.reasoning_zh.length).toBeGreaterThan(0)
    expect(r.reasoning_en.length).toBeGreaterThan(0)
  })
})

describe('recommendNextMove', () => {
  it('pick_attacker: returns the (atk,def) pair with max preview damage', () => {
    const state = mkState({
      attacker_cards: [mkBattleCard(C_BASIC), mkBattleCard(C_PIERCE)],
      defender_cards: [mkBattleCard(C_SHIELD), mkBattleCard(C_BASIC)],
      current_phase: 'pick_attacker',
    })
    const rec = recommendNextMove(state)
    expect(rec.phase).toBe('pick_attacker')
    expect(rec.attacker_id).toBeTruthy()
    expect(rec.target_id).toBeTruthy()
    expect(rec.expected_damage).toBeGreaterThan(0)
  })

  it('pick_target: uses already-selected attacker, picks best target', () => {
    const state = mkState({
      attacker_cards: [mkBattleCard(C_BASIC)],
      defender_cards: [mkBattleCard(C_SHIELD), mkBattleCard(C_BASIC)],
      current_phase: 'pick_target',
      selected_attacker_id: C_BASIC.id,
    })
    const rec = recommendNextMove(state)
    expect(rec.phase).toBe('pick_target')
    expect(rec.attacker_id).toBe(C_BASIC.id)
    // C_BASIC (def 8) is softer than C_SHIELD (def 10) → pick basic
    expect(rec.target_id).toBe(C_BASIC.id)
  })

  it('all friend cards played: returns phase=none', () => {
    const a = mkBattleCard(C_BASIC); a.is_played = true
    const state = mkState({
      attacker_cards: [a],
      defender_cards: [mkBattleCard(C_BASIC)],
      current_phase: 'pick_attacker',
    })
    expect(recommendNextMove(state).phase).toBe('none')
  })

  it('non-decision phase: returns none', () => {
    const state = mkState({ current_phase: 'animating_player' })
    expect(recommendNextMove(state).phase).toBe('none')
  })
})
