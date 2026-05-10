import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clashStateQueryKey } from './clashState'
import type { CrCardId } from '@/clash/lib/cardData'
import type { UnlockCardResult, UpgradeCardResult } from '@/clash/lib/types'

export function useUnlockCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: CrCardId): Promise<UnlockCardResult> => {
      const { data, error } = await supabase.rpc(
        'cr_unlock_card' as never,
        { p_card_id: cardId } as never,
      )
      if (error) throw error
      return data as unknown as UnlockCardResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clashStateQueryKey })
    },
  })
}

export function useUpgradeCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: CrCardId): Promise<UpgradeCardResult> => {
      const { data, error } = await supabase.rpc(
        'cr_upgrade_card' as never,
        { p_card_id: cardId } as never,
      )
      if (error) throw error
      return data as unknown as UpgradeCardResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clashStateQueryKey })
    },
  })
}
