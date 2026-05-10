export function computeReviveAmount(prevStreakLength: number | null | undefined): number {
  if (!prevStreakLength || prevStreakLength <= 1) return 0
  return Math.floor(prevStreakLength / 2)
}

export interface CanReviveInput {
  current_streak: number
  last_workout_date: string | null
  freeze_xp_until: string | null
}

export function canRevive(user: CanReviveInput, now: Date): boolean {
  if (user.current_streak !== 0) return false
  if (!user.last_workout_date) return false
  if (user.freeze_xp_until && new Date(user.freeze_xp_until) > now) return false

  const last = new Date(user.last_workout_date + 'T00:00:00Z')
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z')
  const daysDiff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff >= 1 && daysDiff <= 7
}
