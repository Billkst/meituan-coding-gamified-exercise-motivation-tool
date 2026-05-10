import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DevAction =
  | 'set_streak'
  | 'grant_legendary'
  | 'level_up'
  | 'break_streak'
  | 'reset_progress'
  | 'grant_protect'
  | 'reset_onboarding'
  | 'grant_gold'
  | 'unlock_all_cr_cards'
  | 'instant_open_chests'
  | 'reset_clash'

export interface DevDispatchInput {
  action: DevAction
  params?: Record<string, unknown>
}

export function useDevDispatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ action, params }: DevDispatchInput) => {
      const { data, error } = await supabase.rpc('dev_dispatch' as never, {
        p_action: action,
        p_params: params ?? {},
      } as never)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}
