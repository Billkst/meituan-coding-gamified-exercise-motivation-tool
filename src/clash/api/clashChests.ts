import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clashStateQueryKey } from './clashState'
import type { OpenChestResult } from '@/clash/lib/types'

export function useOpenChest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chestId: string): Promise<OpenChestResult> => {
      const { data, error } = await supabase.rpc(
        'cr_open_chest' as never,
        { p_chest_id: chestId } as never,
      )
      if (error) throw error
      return data as unknown as OpenChestResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clashStateQueryKey })
    },
  })
}

export function useUnlockChestNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chestId: string): Promise<{ success: boolean; chest_id: string }> => {
      const { data, error } = await supabase.rpc(
        'cr_unlock_chest_now' as never,
        { p_chest_id: chestId } as never,
      )
      if (error) throw error
      return data as unknown as { success: boolean; chest_id: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clashStateQueryKey })
    },
  })
}
