import { describe, it, expect } from 'vitest'
import {
  CR_CARDS,
  CR_CARDS_BY_ID,
  scaleStatsForLevel,
  nextUpgradeCost,
  UPGRADE_COSTS,
} from '@/clash/lib/cardData'

describe('CR_CARDS catalog', () => {
  it('has exactly 12 cards', () => {
    expect(CR_CARDS).toHaveLength(12)
  })

  it('has unique ids', () => {
    const ids = new Set(CR_CARDS.map((c) => c.id))
    expect(ids.size).toBe(12)
  })

  it('has 8 free + 4 paid cards', () => {
    const free = CR_CARDS.filter((c) => c.unlock_cost === 0)
    const paid = CR_CARDS.filter((c) => c.unlock_cost > 0)
    expect(free).toHaveLength(8)
    expect(paid).toHaveLength(4)
  })

  it('every troop has hp + dmg + move_speed + range + target', () => {
    for (const card of CR_CARDS.filter((c) => c.card_type === 'troop')) {
      expect(card.base_stats.hp, `${card.id} hp`).toBeGreaterThan(0)
      expect(card.base_stats.dmg, `${card.id} dmg`).toBeGreaterThan(0)
      expect(card.base_stats.move_speed, `${card.id} move_speed`).toBeGreaterThan(0)
      expect(card.base_stats.range, `${card.id} range`).toBeGreaterThan(0)
      expect(card.base_stats.target).toBeDefined()
    }
  })

  it('every spell has dmg + radius', () => {
    for (const card of CR_CARDS.filter((c) => c.card_type === 'spell')) {
      expect(card.base_stats.dmg).toBeGreaterThan(0)
      expect(card.base_stats.radius).toBeGreaterThan(0)
    }
  })

  it('every building has hp + dmg + range (no move_speed)', () => {
    for (const card of CR_CARDS.filter((c) => c.card_type === 'building')) {
      expect(card.base_stats.hp).toBeGreaterThan(0)
      expect(card.base_stats.dmg).toBeGreaterThan(0)
      expect(card.base_stats.range).toBeGreaterThan(0)
      expect(card.base_stats.move_speed).toBeUndefined()
    }
  })

  it('CR_CARDS_BY_ID lookup works for every id', () => {
    for (const card of CR_CARDS) {
      expect(CR_CARDS_BY_ID[card.id]).toBe(card)
    }
  })
})

describe('scaleStatsForLevel', () => {
  it('level 1 returns base stats unchanged', () => {
    const base = { hp: 1500, dmg: 150 }
    const scaled = scaleStatsForLevel(base, 1)
    expect(scaled.hp).toBe(1500)
    expect(scaled.dmg).toBe(150)
  })

  it('level 11 returns 200% of base', () => {
    const base = { hp: 1000, dmg: 100 }
    const scaled = scaleStatsForLevel(base, 11)
    expect(scaled.hp).toBe(2000)
    expect(scaled.dmg).toBe(200)
  })

  it('level 5 returns 140% of base', () => {
    const base = { hp: 1000, dmg: 100 }
    const scaled = scaleStatsForLevel(base, 5)
    expect(scaled.hp).toBe(1400)
    expect(scaled.dmg).toBe(140)
  })

  it('preserves non-scaled fields', () => {
    const base = { hp: 100, dmg: 20, hit_speed: 1.2, range: 5, target: 'ground' as const }
    const scaled = scaleStatsForLevel(base, 6)
    expect(scaled.hit_speed).toBe(1.2)
    expect(scaled.range).toBe(5)
    expect(scaled.target).toBe('ground')
  })

  it('clamps levels below 1 and above 11', () => {
    const base = { hp: 100, dmg: 100 }
    expect(scaleStatsForLevel(base, 0).hp).toBe(100)
    expect(scaleStatsForLevel(base, 99).hp).toBe(200)
  })

  it('skips fields that are undefined (e.g. spells have no hp)', () => {
    const base = { dmg: 200, radius: 4 }
    const scaled = scaleStatsForLevel(base, 5)
    expect(scaled.hp).toBeUndefined()
    expect(scaled.dmg).toBe(280)
    expect(scaled.radius).toBe(4)
  })
})

describe('nextUpgradeCost', () => {
  it('returns null at max level', () => {
    expect(nextUpgradeCost(11)).toBeNull()
  })

  it('returns target-2 cost when at level 1', () => {
    expect(nextUpgradeCost(1)).toEqual(UPGRADE_COSTS[2])
  })

  it('returns target-11 cost when at level 10', () => {
    expect(nextUpgradeCost(10)).toEqual(UPGRADE_COSTS[11])
  })
})
