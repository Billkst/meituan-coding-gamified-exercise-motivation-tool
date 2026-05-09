import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { UserRow } from '@/types/db'

export function useCurrentUser() {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['users', 'me', authUser?.id],
    queryFn: async (): Promise<UserRow | null> => {
      if (!authUser) return null
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      if (error) throw error
      return data as UserRow
    },
    enabled: !!authUser,
  })
}

export function useMyCardCount() {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['user_cards', 'count', authUser?.id],
    queryFn: async (): Promise<number> => {
      if (!authUser) return 0
      const { count, error } = await supabase
        .from('user_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!authUser,
  })
}
