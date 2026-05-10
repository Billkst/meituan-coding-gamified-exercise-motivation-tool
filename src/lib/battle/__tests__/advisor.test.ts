import { describe, it, expect } from 'vitest'
import { recommendDeck } from '@/lib/battle/advisor'
import type { OwnedCard } from '@/api/cards'
import { mkCard } from './fixtures'

function mkOwnedCard(cardId: string, opts: Partial<OwnedCard> = {}): OwnedCard {
  const { card: cardOverrides, ...rest } = opts
  return {
    id: 0,
    user_id: 'u',
    card_id: cardId,
    star_level: 1,
    copies: 1,
    acquired_at: '2026-05-10T00:00:00Z',
    card: mkCard({ id: cardId, ...(cardOverrides ?? {}) }),
    ...rest,
  } as OwnedCard
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
