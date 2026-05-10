import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { Deck } from '@/types/db'

export function useActiveDeck() {
  const authUser = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['active_deck', authUser?.id],
    enabled: !!authUser,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', authUser!.id)
        .eq('is_active', true)
        .single()
      if (error) {
        if (error.code === 'PGRST116') return null  // no active deck
        throw error
      }
      return data as Deck
    },
  })
}

export function useSaveDeck() {
  const authUser = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardIds: string[]) => {
      if (!authUser) throw new Error('not authenticated')
      if (cardIds.length !== 8) throw new Error(`deck must have 8 cards, got ${cardIds.length}`)
      const { data, error } = await supabase
        .from('decks')
        .update({ card_ids: cardIds })
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .select()
        .single()
      if (error) throw error
      return data as Deck
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active_deck'] })
    },
  })
}
