import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clashStateQueryKey } from './clashState'
import type { FinalizeMatchInput, FinalizeMatchResult } from '@/clash/lib/types'

export function useFinalizeMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: FinalizeMatchInput): Promise<FinalizeMatchResult> => {
      const { data, error } = await supabase.rpc(
        'cr_finalize_match' as never,
        {
          p_result: input.result,
          p_duration: input.duration,
          p_player_towers_lost: input.player_towers_lost,
          p_ai_towers_lost: input.ai_towers_lost,
          p_difficulty: input.difficulty,
          p_replay: input.replay ?? {},
        } as never,
      )
      if (error) throw error
      return data as unknown as FinalizeMatchResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clashStateQueryKey })
    },
  })
}
