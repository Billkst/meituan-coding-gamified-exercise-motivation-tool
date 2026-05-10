import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

export type LeaderboardPeriod = 'all' | 'month' | 'week'

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  level: number
  score: number
  streak: number
  is_self: boolean
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod
  total_users: number
  user_rank: number | null
  user_score: number | null
  user_percentile: number
  entries: LeaderboardEntry[]
}

export function useLeaderboard(period: LeaderboardPeriod) {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['leaderboard', period, authUser?.id],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const { data, error } = await supabase.rpc('get_leaderboard' as never, {
        p_period: period,
        p_limit: 100,
      } as never)
      if (error) throw error
      return data as unknown as LeaderboardResponse
    },
    enabled: !!authUser,
  })
}
