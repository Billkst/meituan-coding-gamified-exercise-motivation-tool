import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clashStateQueryKey } from './clashState'
import type { CrCardId } from '@/clash/lib/cardData'

export function useSetDeck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardIds: CrCardId[]): Promise<{ success: boolean; deck: CrCardId[] }> => {
      const { data, error } = await supabase.rpc(
        'cr_set_deck' as never,
        { p_card_ids: cardIds } as never,
      )
      if (error) throw error
      return data as unknown as { success: boolean; deck: CrCardId[] }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clashStateQueryKey })
    },
  })
}
