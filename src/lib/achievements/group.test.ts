import { describe, it, expect } from 'vitest'
import { groupByCategory, type AchievementVM } from './group'

const sample: AchievementVM[] = [
  { id: 'a1', category: 'workout', display_order: 2 },
  { id: 'a2', category: 'workout', display_order: 1 },
  { id: 'b1', category: 'arena', display_order: 1 },
  { id: 's1', category: 'special', display_order: 3 },
]

describe('groupByCategory', () => {
  it('groups achievements by category', () => {
    const grouped = groupByCategory(sample)
    expect(grouped.workout).toHaveLength(2)
    expect(grouped.arena).toHaveLength(1)
    expect(grouped.special).toHaveLength(1)
    expect(grouped.cards).toHaveLength(0)
    expect(grouped.streak).toHaveLength(0)
  })

  it('sorts within category by display_order', () => {
    const grouped = groupByCategory(sample)
    expect(grouped.workout[0].id).toBe('a2')
    expect(grouped.workout[1].id).toBe('a1')
  })

  it('returns empty arrays for missing categories on empty input', () => {
    const grouped = groupByCategory([])
    expect(grouped.workout).toEqual([])
    expect(grouped.streak).toEqual([])
    expect(grouped.cards).toEqual([])
    expect(grouped.arena).toEqual([])
    expect(grouped.special).toEqual([])
  })
})
