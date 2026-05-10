import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface OnboardingPackResult {
  cards: Array<{ id: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' }>
  idempotent: boolean
}

export function useGrantOnboardingPack() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['onboarding-pack'],
    mutationFn: async (buffs: Record<string, number>): Promise<OnboardingPackResult> => {
      const { data, error } = await supabase.rpc('grant_onboarding_pack' as never, { p_buffs: buffs } as never)
      if (error) throw error
      return data as unknown as OnboardingPackResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user_cards'] })
    },
  })
}
