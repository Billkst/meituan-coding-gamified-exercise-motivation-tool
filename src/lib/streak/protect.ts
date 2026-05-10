export type StreakStatus = 'new' | 'continued' | 'protected' | 'broken' | 'same_day'

export interface ComputeNextStreakInput {
  gap: number
  current: number
  protect: number
}

export interface ComputeNextStreakOutput {
  next: number
  status: StreakStatus
  protect_consumed: boolean
  protect_after: number
}

export function computeNextStreak(input: ComputeNextStreakInput): ComputeNextStreakOutput {
  const { gap, current, protect } = input
  if (gap === 0) {
    return { next: current, status: 'same_day', protect_consumed: false, protect_after: protect }
  }
  if (gap === 1) {
    return { next: current + 1, status: 'continued', protect_consumed: false, protect_after: protect }
  }
  if (current === 0 && gap >= 2) {
    return { next: 1, status: 'new', protect_consumed: false, protect_after: protect }
  }
  if (protect >= 1) {
    return { next: current + 1, status: 'protected', protect_consumed: true, protect_after: protect - 1 }
  }
  return { next: 1, status: 'broken', protect_consumed: false, protect_after: protect }
}
