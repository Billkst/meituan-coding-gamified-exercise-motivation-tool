import { describe, it, expect } from 'vitest'
import { shouldGrantProtect } from '../grant'

describe('shouldGrantProtect', () => {
  const now = new Date('2026-05-10T00:00:00Z')

  it('last_grant 6 days ago, stock 2 → false', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-04T00:00:00Z',
      protect_cards: 2,
    }, now)).toBe(false)
  })

  it('last_grant 7 days ago, stock 3 (full) → false', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-03T00:00:00Z',
      protect_cards: 3,
    }, now)).toBe(false)
  })

  it('last_grant 7 days ago, stock 2 → true', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-03T00:00:00Z',
      protect_cards: 2,
    }, now)).toBe(true)
  })

  it('last_grant 14 days ago, stock 1 → true (only 1 grant, not 2)', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-04-26T00:00:00Z',
      protect_cards: 1,
    }, now)).toBe(true)
  })

  it('last_grant exactly 6.99 days → false', () => {
    expect(shouldGrantProtect({
      last_protect_grant_at: '2026-05-03T00:14:24Z',
      protect_cards: 0,
    }, now)).toBe(false)
  })
})
