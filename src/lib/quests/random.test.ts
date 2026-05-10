import { describe, it, expect, vi } from 'vitest'
import { pickQuestTemplate } from './random'
import type { QuestTemplateRow } from '@/types/db'

const fakePool: QuestTemplateRow[] = [
  { id: 'a', difficulty: 'easy', metric: 'workout_count', target_min: 1, target_max: 1, reward_xp: 50, description_zh: 'a', description_en: 'a', active: true },
  { id: 'b', difficulty: 'easy', metric: 'arena_battles', target_min: 1, target_max: 1, reward_xp: 50, description_zh: 'b', description_en: 'b', active: true },
  { id: 'c', difficulty: 'medium', metric: 'workout_minutes', target_min: 30, target_max: 45, reward_xp: 150, description_zh: 'c', description_en: 'c', active: true },
]

describe('pickQuestTemplate', () => {
  it('returns a template matching the requested difficulty', () => {
    const result = pickQuestTemplate(fakePool, 'easy')
    expect(result).not.toBeNull()
    expect(result!.template.difficulty).toBe('easy')
  })

  it('rolls target within [target_min, target_max]', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const result = pickQuestTemplate([fakePool[2]], 'medium')
    expect(result!.target).toBeGreaterThanOrEqual(30)
    expect(result!.target).toBeLessThanOrEqual(45)
    vi.restoreAllMocks()
  })

  it('returns null when pool has no matching difficulty', () => {
    expect(pickQuestTemplate(fakePool, 'hard')).toBeNull()
  })

  it('filters inactive templates', () => {
    const inactivePool: QuestTemplateRow[] = [{ ...fakePool[0], active: false }]
    expect(pickQuestTemplate(inactivePool, 'easy')).toBeNull()
  })
})
