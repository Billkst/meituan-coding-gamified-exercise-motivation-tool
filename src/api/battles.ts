import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { Battle } from '@/types/db'
import type { BattleLogEntry, FinalizeResult } from '@/lib/battle/types'

export interface StartBattleResult {
  battle_id: number
  attacker_deck_ids: string[]
  defender_deck_ids: string[]
  reward_xp: number
  npc_name_zh: string
  npc_name_en: string
  npc_level: number
  npc_flavor_zh: string | null
  npc_flavor_en: string | null
}

export function useStartBattle() {
  return useMutation({
    mutationFn: async (npcId: string) => {
      const { data, error } = await supabase.rpc('start_battle' as never, {
        p_npc_id: npcId,
      } as never)
      if (error) throw error
      return data as unknown as StartBattleResult
    },
  })
}

export function useFinalizeBattle() {
  return useMutation({
    mutationFn: async (args: { battleId: number; log: BattleLogEntry[] }) => {
      const { data, error } = await supabase.rpc('finalize_battle' as never, {
        p_battle_id: args.battleId,
        p_log: args.log,
      } as never)
      if (error) throw error
      return data as unknown as FinalizeResult
    },
  })
}

export type BattleWithLog = Omit<Battle, 'log'> & {
  log: BattleLogEntry[] | null
}

export function useBattle(battleId: number | null) {
  const authUser = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['battle', battleId],
    enabled: !!battleId && !!authUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId!)
        .single()
      if (error) throw error
      return data as BattleWithLog
    },
  })
}
