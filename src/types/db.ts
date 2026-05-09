/**
 * Database types — manually maintained for Day 2.
 * Day later: regenerate via `bunx supabase gen types typescript --linked > src/types/db.ts`
 */

export type SportCategory = 'cardio' | 'strength' | 'ball' | 'flex' | 'martial' | 'outdoor'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type Intensity = 'light' | 'medium' | 'high'
export type StreakStatus = 'active' | 'broken' | 'frozen'

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
  attacker_deck_ids: string[]
  defender_deck_ids: string[]
  winner_id: string | null
  attacker_xp_delta: number
  defender_xp_delta: number
  season: string
  created_at: string
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
    }
  }
}
