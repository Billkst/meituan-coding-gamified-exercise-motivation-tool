import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { NpcOpponent, UserRow } from '@/types/db'

export interface NpcOpponentWithUnlock extends NpcOpponent {
  is_unlocked: boolean
}

export function useNpcOpponents() {
  const authUser = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['npc_opponents', authUser?.id],
    enabled: !!authUser,
    staleTime: 60_000,
    queryFn: async () => {
      const [npcRes, userRes] = await Promise.all([
        supabase.from('npc_opponents').select('*').order('level', { ascending: true }),
        supabase.from('users').select('level').eq('id', authUser!.id).single(),
      ])
      if (npcRes.error) throw npcRes.error
      if (userRes.error) throw userRes.error
      const userLevel = (userRes.data as Pick<UserRow, 'level'>).level
      return (npcRes.data as NpcOpponent[]).map<NpcOpponentWithUnlock>((n) => ({
        ...n,
        is_unlocked: userLevel >= n.unlock_at_level,
      }))
    },
  })
}
