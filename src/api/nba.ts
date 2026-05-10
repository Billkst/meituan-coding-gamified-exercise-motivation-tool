import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

export interface NbaState {
  workouts_count: number
  owned_cards_count: number
  active_deck_size: number
  pve_battle_count: number
  pvp_battle_count: number
  active_friends_count: number
  quests_completable_unclaimed: number
}

export function useNbaState() {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['nba-state', authUser?.id],
    enabled: !!authUser,
    queryFn: async (): Promise<NbaState> => {
      const { data, error } = await supabase.rpc('get_nba_state' as never, {} as never)
      if (error) throw error
      return data as unknown as NbaState
    },
  })
}

export type NbaStage =
  | 'first_workout'
  | 'collect_cards'
  | 'build_deck'
  | 'first_pve'
  | 'first_friend'
  | 'daily_quests'
  | 'done'

// Pure decision function — given counters, pick which stage card to show.
// Order matters: each branch is a subgoal that gates the next.
export function pickNbaStage(s: NbaState | undefined | null): NbaStage | null {
  if (!s) return null
  if (s.workouts_count === 0) return 'first_workout'
  if (s.owned_cards_count < 8) return 'collect_cards'
  if (s.active_deck_size < 8) return 'build_deck'
  if (s.pve_battle_count === 0) return 'first_pve'
  if (s.active_friends_count === 0) return 'first_friend'
  if (s.quests_completable_unclaimed > 0) return 'daily_quests'
  return 'done'
}
