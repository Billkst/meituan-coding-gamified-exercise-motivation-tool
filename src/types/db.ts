/**
 * Database types — manually maintained for Day 2.
 * Day later: regenerate via `bunx supabase gen types typescript --linked > src/types/db.ts`
 */

export type SportCategory = 'cardio' | 'strength' | 'ball' | 'flex' | 'martial' | 'outdoor'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type Intensity = 'light' | 'medium' | 'high'
export type StreakStatus = 'active' | 'broken' | 'frozen'
export type AchievementCategory = 'workout' | 'streak' | 'cards' | 'arena' | 'special'
export type RewardKind = 'xp' | 'protect' | 'card' | 'badge_only'
export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export interface Sport {
  id: string
  name_zh: string
  name_en: string
  category: SportCategory
  icon: string
  base_xp_multiplier: number
  display_order: number
}

export interface UserRow {
  id: string
  username: string
  level: number
  xp: number
  total_workouts: number
  current_streak: number
  longest_streak: number
  last_workout_date: string | null
  exploration_buffs: Record<string, number>
  protect_cards: number
  season_score: number
  created_at: string
  updated_at: string
  freeze_xp_until: string | null
  last_protect_grant_at: string | null
  onboarded_at: string | null
  last_quest_date: string | null
  last_quest_bonus_date: string | null
}

export interface AchievementRow {
  id: string
  category: AchievementCategory
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  metric: string
  tier: number
  target_value: number
  reward_kind: RewardKind
  reward_payload: Record<string, unknown>
  icon: string
  display_order: number
  parent_id: string | null
}

export interface UserAchievementRow {
  user_id: string
  achievement_id: string
  current_value: number
  unlocked_at: string | null
  claimed_at: string | null
}

export interface QuestTemplateRow {
  id: string
  difficulty: QuestDifficulty
  metric: string
  target_min: number
  target_max: number
  reward_xp: number
  description_zh: string
  description_en: string
  active: boolean
}

export interface DailyQuestRow {
  user_id: string
  quest_date: string
  slot: number
  template_id: string
  metric: string
  target_value: number
  current_value: number
  reward_xp: number
  completed_at: string | null
  claimed_at: string | null
}

export interface UserStats {
  summary: {
    joined_days: number
    total_workouts: number
    total_minutes: number
    total_xp: number
    level: number
    card_count: number
    card_total_pool: number
    arena_wins: number
    arena_losses: number
    current_streak: number
    longest_streak: number
  }
  xp_trend: Array<{ date: string; xp: number }>
  sport_breakdown: Array<{ sport_id: string; count: number; total_minutes: number }>
  arena: { wins: number; losses: number; battles_total: number; win_rate_pp: number }
  card_collection: Array<{ rarity: Rarity; owned: number; total: number }>
}

export interface Card {
  id: string
  name_zh: string
  name_en: string
  rarity: Rarity
  base_attack: number
  base_defense: number
  ability_text_zh: string | null
  ability_text_en: string | null
  synergy_with: string[]
  ability_kind: 'damage_buff' | 'defense_buff' | 'heal' | 'shield' | 'pierce' | 'reflect' | 'first_strike' | 'xp_bonus' | null
  ability_value: number
  ability_trigger: 'on_play' | 'on_attack' | 'on_defend' | 'on_battle_end' | 'passive' | null
  flavor_zh: string | null
  flavor_en: string | null
}

export interface UserCard {
  id: number
  user_id: string
  card_id: string
  star_level: number
  copies: number
  acquired_at: string
}

export interface Workout {
  id: number
  user_id: string
  sport_id: string
  duration_minutes: number
  intensity: Intensity
  xp_gained: number
  cards_drawn: string[]
  created_at: string
}

export interface Streak {
  id: number
  user_id: string
  start_date: string
  end_date: string | null
  length: number
  status: StreakStatus
  frozen_until: string | null
}

export interface Deck {
  id: number
  user_id: string
  name: string
  card_ids: string[]
  is_active: boolean
  updated_at: string
}

export interface Battle {
  id: number
  attacker_id: string
  defender_id: string | null
  npc_id: string | null
  attacker_deck_ids: string[]
  defender_deck_ids: string[]
  winner_id: string | null
  attacker_xp_delta: number
  defender_xp_delta: number
  log: Record<string, unknown>[] | null
  season: string
  created_at: string
}

export type AbilityKind =
  | 'damage_buff' | 'defense_buff' | 'heal' | 'shield'
  | 'pierce' | 'reflect' | 'first_strike' | 'xp_bonus'

export type AbilityTrigger =
  | 'on_play' | 'on_attack' | 'on_defend' | 'on_battle_end' | 'passive'

export interface NpcOpponent {
  id: string
  name_zh: string
  name_en: string
  level: number
  deck_card_ids: string[]
  reward_xp: number
  unlock_at_level: number
  flavor_zh: string | null
  flavor_en: string | null
}

// Day 11: friendships + PVP
export type FriendshipStatus = 'pending' | 'active'

export interface FriendshipRow {
  user_id: string
  friend_id: string
  status: FriendshipStatus
  created_at: string
}

export interface FriendListItem {
  user_id: string
  username: string
  level: number
  season_score: number
  current_streak?: number
  last_workout_date?: string | null
}

export interface FriendList {
  active: FriendListItem[]
  incoming: FriendListItem[]
  outgoing: FriendListItem[]
}

export interface PvpStartResult {
  battle_id: number
  attacker_deck_ids: string[]
  defender_deck_ids: string[]
  opponent_user_id: string
  opponent_username: string
  opponent_level: number
  kind: 'pvp'
}

export interface Database {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: Partial<UserRow> & { id: string }; Update: Partial<UserRow> }
      sports: { Row: Sport; Insert: Sport; Update: Partial<Sport> }
      cards: { Row: Card; Insert: Card; Update: Partial<Card> }
      user_cards: {
        Row: UserCard
        Insert: Omit<UserCard, 'id' | 'acquired_at'> & { acquired_at?: string }
        Update: Partial<UserCard>
      }
      workouts: {
        Row: Workout
        Insert: Omit<Workout, 'id' | 'created_at'> & { created_at?: string }
        Update: Partial<Workout>
      }
      streaks: {
        Row: Streak
        Insert: Omit<Streak, 'id'>
        Update: Partial<Streak>
      }
      decks: {
        Row: Deck
        Insert: Omit<Deck, 'id' | 'updated_at'> & { updated_at?: string }
        Update: Partial<Deck>
      }
      battles: {
        Row: Battle
        Insert: Omit<Battle, 'id' | 'created_at' | 'season'> & {
          created_at?: string
          season?: string
        }
        Update: Partial<Battle>
      }
      npc_opponents: { Row: NpcOpponent; Insert: NpcOpponent; Update: Partial<NpcOpponent> }
    }
  }
}
