import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { QuestDifficulty } from '@/types/db'

export interface QuestItem {
  slot: number
  difficulty: QuestDifficulty
  metric: string
  description_zh: string
  description_en: string
  target: number
  current: number
  reward_xp: number
  completed_at: string | null
  claimed_at: string | null
}

export interface QuestsResponse {
  quests: QuestItem[]
  all_completed_bonus_claimed: boolean
}

export type ClaimQuestResult =
  | { ok: true; kind: 'quest'; slot: number; xp: number }
  | { ok: true; kind: 'bonus'; xp: number; card_id: string }

export function useDailyQuests() {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['daily_quests', authUser?.id],
    queryFn: async (): Promise<QuestsResponse> => {
      const { data, error } = await supabase.rpc('get_daily_quests' as never)
      if (error) throw error
      return data as unknown as QuestsResponse
    },
    enabled: !!authUser,
  })
}

export function useClaimQuest() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['claim-quest'],
    mutationFn: async (args: { slot?: number; bonus?: boolean }): Promise<ClaimQuestResult> => {
      const params = args.bonus
        ? { p_slot: 0, p_claim_bonus: true }
        : { p_slot: args.slot, p_claim_bonus: false }
      const { data, error } = await supabase.rpc('claim_quest' as never, params as never)
      if (error) throw error
      return data as unknown as ClaimQuestResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily_quests'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user_cards'] })
      qc.invalidateQueries({ queryKey: ['achievements'] })
    },
  })
}
