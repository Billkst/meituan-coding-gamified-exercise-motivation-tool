// Shared types for Clash module — bridge between API responses and UI/engine.

import type { CrCardDef, CrCardId } from './cardData'

export interface ClashCardWithUser extends CrCardDef {
  unlocked: boolean
  level: number
  shards: number
}

export type ChestType = 'silver' | 'gold'

export interface ClashChest {
  id: string
  chest_type: ChestType
  unlocks_at: string
  rewards: ClashChestRewards | null
}

export interface ClashChestRewards {
  gold: number
  shards: number
  breakdown: Array<{ card_id: CrCardId; shards: number }>
}

export interface ClashState {
  gold: number
  shards_total: number
  cards: ClashCardWithUser[]
  deck: CrCardId[]
  chests: ClashChest[]
  win_streak: number
}

export type AiDifficulty = 'easy' | 'normal' | 'hard'
export type MatchResult = 'win' | 'loss' | 'draw'

export interface FinalizeMatchInput {
  result: MatchResult
  duration: number
  player_towers_lost: number
  ai_towers_lost: number
  difficulty: AiDifficulty
  replay?: Record<string, unknown>
}

export interface FinalizeMatchResult {
  match_id: string
  result: MatchResult
  gold_earned: number
  chest_id: string | null
  chest_type: ChestType | null
  win_streak: number
}

export interface OpenChestResult {
  success: boolean
  chest_id: string
  chest_type: ChestType
  gold: number
  shards: number
  breakdown: Array<{ card_id: CrCardId; shards: number }>
}

export interface UnlockCardResult {
  success: boolean
  gold: number
  card_id: CrCardId
  unlocked: boolean
  level: number
}

export interface UpgradeCardResult {
  success: boolean
  gold: number
  card_id: CrCardId
  level: number
  shards: number
}
