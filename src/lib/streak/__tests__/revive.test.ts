import { describe, it, expect } from 'vitest'
import { computeReviveAmount, canRevive } from '../revive'

describe('computeReviveAmount', () => {
  it('prev_streak=10 → 5', () => expect(computeReviveAmount(10)).toBe(5))
  it('prev_streak=11 → 5 (floor)', () => expect(computeReviveAmount(11)).toBe(5))
  it('prev_streak=1 → 0', () => expect(computeReviveAmount(1)).toBe(0))
  it('prev_streak=0 → 0', () => expect(computeReviveAmount(0)).toBe(0))
  it('null/undefined → 0', () => expect(computeReviveAmount(null)).toBe(0))
})

describe('canRevive', () => {
  const today = new Date('2026-05-10T12:00:00Z')

  it('streak=0 + 6 days ago → true', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-04',
      freeze_xp_until: null,
    }, today)).toBe(true)
  })

  it('streak=0 + 7 days ago → true (boundary)', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-03',
      freeze_xp_until: null,
    }, today)).toBe(true)
  })

  it('streak=0 + 8 days ago → false', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-02',
      freeze_xp_until: null,
    }, today)).toBe(false)
  })

  it('freeze_until in future → false', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: '2026-05-04',
      freeze_xp_until: '2026-05-11T00:00:00Z',
    }, today)).toBe(false)
  })

  it('streak > 0 → false', () => {
    expect(canRevive({
      current_streak: 5,
      last_workout_date: '2026-05-09',
      freeze_xp_until: null,
    }, today)).toBe(false)
  })

  it('last_workout_date null → false', () => {
    expect(canRevive({
      current_streak: 0,
      last_workout_date: null,
      freeze_xp_until: null,
    }, today)).toBe(false)
  })
})
