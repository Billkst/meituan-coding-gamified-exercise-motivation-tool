import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { FriendList } from '@/types/db'

const QK = ['friends'] as const

export function useFriendsList() {
  const authUser = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: QK,
    enabled: !!authUser,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_friends' as never, {} as never)
      if (error) throw error
      return data as unknown as FriendList
    },
  })
}

function makeMutation(rpc: string, paramKey: string) {
  return function useFriendMutation() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (targetId: string) => {
        const { error } = await supabase.rpc(rpc as never, {
          [paramKey]: targetId,
        } as never)
        if (error) throw error
      },
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: QK })
      },
    })
  }
}

export const useSendFriendRequest    = makeMutation('send_friend_request',    'p_to')
export const useAcceptFriendRequest  = makeMutation('accept_friend_request',  'p_from')
export const useDeclineFriendRequest = makeMutation('decline_friend_request', 'p_from')
export const useCancelFriendRequest  = makeMutation('cancel_friend_request',  'p_to')
export const useUnfriend             = makeMutation('unfriend',               'p_friend')
