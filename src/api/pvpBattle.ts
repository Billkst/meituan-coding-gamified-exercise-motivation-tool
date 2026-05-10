import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PvpStartResult } from '@/types/db'

export function useStartPvpBattle() {
  return useMutation({
    mutationFn: async (opponentId: string) => {
      const { data, error } = await supabase.rpc('start_pvp_battle' as never, {
        p_opponent_id: opponentId,
      } as never)
      if (error) throw error
      return data as unknown as PvpStartResult
    },
  })
}
