import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ReviveResult {
  revived_streak: number
  freeze_until: string
}

export function useReviveStreak() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ReviveResult> => {
      const { data, error } = await supabase.rpc('revive_streak' as never)
      if (error) throw error
      return data as unknown as ReviveResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
