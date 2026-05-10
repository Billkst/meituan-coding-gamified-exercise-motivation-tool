import type { AchievementCategory } from '@/types/db'

export interface AchievementVM {
  id: string
  category: AchievementCategory
  display_order: number
  [key: string]: unknown
}

export type GroupedAchievements = Record<AchievementCategory, AchievementVM[]>

const CATEGORIES: AchievementCategory[] = ['workout', 'streak', 'cards', 'arena', 'special']

export function groupByCategory(achievements: AchievementVM[]): GroupedAchievements {
  const result: GroupedAchievements = {
    workout: [],
    streak: [],
    cards: [],
    arena: [],
    special: [],
  }
  for (const a of achievements) {
    if (a.category in result) {
      result[a.category].push(a)
    }
  }
  for (const cat of CATEGORIES) {
    result[cat].sort((x, y) => x.display_order - y.display_order)
  }
  return result
}
