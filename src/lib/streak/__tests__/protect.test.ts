import { describe, it, expect } from 'vitest'
import { computeNextStreak } from '../protect'

describe('computeNextStreak', () => {
  it('gap=0 → same_day, no change', () => {
    expect(computeNextStreak({ gap: 0, current: 5, protect: 1 }))
      .toEqual({ next: 5, status: 'same_day', protect_consumed: false, protect_after: 1 })
  })

  it('gap=1 protect=0 → continued', () => {
    expect(computeNextStreak({ gap: 1, current: 5, protect: 0 }))
      .toEqual({ next: 6, status: 'continued', protect_consumed: false, protect_after: 0 })
  })

  it('gap=2 protect=1 → protected, consumes 1', () => {
    expect(computeNextStreak({ gap: 2, current: 5, protect: 1 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 0 })
  })

  it('gap=2 protect=0 → broken', () => {
    expect(computeNextStreak({ gap: 2, current: 5, protect: 0 }))
      .toEqual({ next: 1, status: 'broken', protect_consumed: false, protect_after: 0 })
  })

  it('gap=3 protect=3 → protected (consumes only 1)', () => {
    expect(computeNextStreak({ gap: 3, current: 5, protect: 3 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 2 })
  })

  it('gap=8 protect=3 → protected (1 protect covers any gap≥2 in this simplified model)', () => {
    expect(computeNextStreak({ gap: 8, current: 5, protect: 3 }))
      .toEqual({ next: 6, status: 'protected', protect_consumed: true, protect_after: 2 })
  })

  it('first workout (gap=999, current=0) → new', () => {
    expect(computeNextStreak({ gap: 999, current: 0, protect: 0 }))
      .toEqual({ next: 1, status: 'new', protect_consumed: false, protect_after: 0 })
  })
})
