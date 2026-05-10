import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClashState } from '@/clash/lib/types'

const QK_CLASH_STATE = ['clash', 'state'] as const

export function useClashState() {
  return useQuery({
    queryKey: QK_CLASH_STATE,
    queryFn: async (): Promise<ClashState> => {
      const { data, error } = await supabase.rpc('cr_get_state' as never, {} as never)
      if (error) throw error
      return data as unknown as ClashState
    },
    staleTime: 30_000,
  })
}

export const clashStateQueryKey = QK_CLASH_STATE
