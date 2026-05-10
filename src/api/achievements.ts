import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { AchievementCategory, RewardKind } from '@/types/db'

export interface AchievementItem {
  id: string
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  tier: number
  target: number
  current: number
  icon: string
  parent_id: string | null
  unlocked_at: string | null
  claimed_at: string | null
  reward_kind: RewardKind
  reward_payload: Record<string, unknown>
}

export interface AchievementsResponse {
  categories: Array<{
    key: AchievementCategory
    achievements: AchievementItem[]
  }>
  summary: { total: number; unlocked: number; claimable: number }
}

export interface ClaimAchievementResult {
  ok: true
  reward_kind: RewardKind
  reward_payload: Record<string, unknown>
  achievement_id: string
}

export function useAchievements() {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['achievements', authUser?.id],
    queryFn: async (): Promise<AchievementsResponse> => {
      const { data, error } = await supabase.rpc('get_achievements' as never)
      if (error) throw error
      return data as unknown as AchievementsResponse
    },
    enabled: !!authUser,
  })
}

export function useClaimAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['claim-achievement'],
    mutationFn: async (id: string): Promise<ClaimAchievementResult> => {
      const { data, error } = await supabase.rpc('claim_achievement' as never, { p_id: id } as never)
      if (error) throw error
      return data as unknown as ClaimAchievementResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['achievements'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user_cards'] })
    },
  })
}
