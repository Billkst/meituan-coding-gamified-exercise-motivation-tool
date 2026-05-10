import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { UserStats } from '@/types/db'

export function useUserStats() {
  const authUser = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['user_stats', authUser?.id],
    queryFn: async (): Promise<UserStats> => {
      const { data, error } = await supabase.rpc('get_user_stats' as never)
      if (error) throw error
      return data as unknown as UserStats
    },
    enabled: !!authUser,
  })
}
