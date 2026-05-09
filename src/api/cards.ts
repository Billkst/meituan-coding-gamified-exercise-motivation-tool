import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import type { Card, UserCard } from '@/types/db'

export interface OwnedCard extends UserCard {
  card: Card
}

export function useAllCards() {
  return useQuery({
    queryKey: ['cards', 'all'],
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase.from('cards').select('*')
      if (error) throw error
      return data as Card[]
    },
    staleTime: Infinity,
  })
}

export function useCardById(cardId: string | undefined) {
  return useQuery({
    queryKey: ['cards', 'one', cardId],
    queryFn: async (): Promise<Card | null> => {
      if (!cardId) return null
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .single()
      if (error) throw error
      return data as Card
    },
    enabled: !!cardId,
    staleTime: Infinity,
  })
}

export function useMyCards() {
  const authUser = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['user_cards', 'mine', authUser?.id],
    queryFn: async (): Promise<OwnedCard[]> => {
      if (!authUser) return []
      const { data, error } = await supabase
        .from('user_cards')
        .select('*, card:cards(*)')
        .eq('user_id', authUser.id)
      if (error) throw error
      return (data ?? []) as unknown as OwnedCard[]
    },
    enabled: !!authUser,
  })
}

export interface UpgradeStarResult {
  card_id: string
  star_level: number
  copies: number
  consumed: number
}

export function useUpgradeCard() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (cardId: string): Promise<UpgradeStarResult> => {
      const { data, error } = await supabase.rpc('upgrade_card_star' as never, {
        p_card_id: cardId,
      } as never)
      if (error) throw error
      return data as unknown as UpgradeStarResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user_cards'] })
    },
  })
}

// Star upgrade thresholds (mirrors RPC). Used by UI to show/hide button + cost.
export const STAR_THRESHOLDS: Record<number, number> = {
  1: 2,
  2: 5,
  3: 10,
  4: 20,
}

export function nextStarCost(currentStar: number): number | null {
  if (currentStar >= 5) return null
  return STAR_THRESHOLDS[currentStar] ?? null
}
