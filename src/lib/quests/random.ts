import type { QuestTemplateRow, QuestDifficulty } from '@/types/db'

export interface PickedQuest {
  template: QuestTemplateRow
  target: number
}

export function pickQuestTemplate(
  pool: QuestTemplateRow[],
  difficulty: QuestDifficulty,
): PickedQuest | null {
  const filtered = pool.filter(t => t.difficulty === difficulty && t.active)
  if (filtered.length === 0) return null
  const tpl = filtered[Math.floor(Math.random() * filtered.length)]
  const target = tpl.target_min + Math.floor(Math.random() * (tpl.target_max - tpl.target_min + 1))
  return { template: tpl, target }
}
