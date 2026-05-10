import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Rarity } from '@/types/db'

export interface RecommendedCard {
  id: string
  name_zh: string
  name_en: string
  rarity: Rarity
  base_attack: number
  base_defense: number
}

export interface RecommendDeckResult {
  deck: string[]
  cards: RecommendedCard[]
  legendary_count: number
  epic_count: number
  avg_star: number
  npc_pierce_threat: boolean
  npc_high_def: boolean
}

export function useRecommendDeck() {
  return useMutation({
    mutationFn: async (npcId: string): Promise<RecommendDeckResult> => {
      const { data, error } = await supabase.rpc('recommend_deck_for_npc' as never, {
        p_npc_id: npcId,
      } as never)
      if (error) throw error
      return data as unknown as RecommendDeckResult
    },
  })
}

// Build a localized 1-line reasoning string from the structured response.
export function reasoningFor(rec: RecommendDeckResult, lang: 'zh' | 'en'): string {
  const parts: string[] = []
  if (rec.legendary_count > 0) parts.push(`legendary ×${rec.legendary_count}`)
  if (rec.epic_count > 0) parts.push(`epic ×${rec.epic_count}`)
  parts.push((lang === 'zh' ? '平均 ★' : 'avg ★') + rec.avg_star.toFixed(1))
  if (rec.npc_pierce_threat) parts.push(lang === 'zh' ? '抗穿透' : 'anti-pierce')
  if (rec.npc_high_def) parts.push(lang === 'zh' ? '强力穿盾' : 'pierce-friendly')
  return parts.join(' · ')
}
