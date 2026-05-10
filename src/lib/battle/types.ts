import type { Card, AbilityKind } from '@/types/db'

export interface BattleCard {
  card: Card
  star_level: number
  current_hp: number
  is_alive: boolean
  is_played: boolean
  active_buffs: Buff[]
}

export interface Buff {
  source_card_id: string
  kind: AbilityKind
  value: number
  expires_after_turn: number  // -1 = whole battle
}

export type BattlePhase =
  | 'init'
  | 'pick_attacker'
  | 'pick_target'
  | 'animating_player'
  | 'ai_thinking'
  | 'pick_ai'
  | 'animating_ai'
  | 'finalizing'
  | 'ended'

export type Side = 'attacker' | 'defender'

export interface BattleState {
  battle_id: number
  turn: number  // 1..8 during play, 9 when finalizing
  attacker_hp: number
  defender_hp: number
  attacker_cards: BattleCard[]  // length 8
  defender_cards: BattleCard[]  // length 8
  current_phase: BattlePhase
  selected_attacker_id: string | null
  log: BattleLogEntry[]
  passive_buffs: Buff[]  // applied to "attacker" or "defender" via owner side
}

export interface BattleLogEntry {
  turn: number
  side: Side  // who attacked
  attacker_card_id: string
  defender_card_id: string
  raw_damage: number
  actual_damage: number
  attacker_hp_after: number
  defender_hp_after: number
  triggers_fired: TriggerEvent[]
}

export interface TriggerEvent {
  card_id: string
  kind: AbilityKind
  effect: string  // human-readable for log replay
}

export interface FinalizeResult {
  result: 'win' | 'lose'
  xp_gained: number
  base_reward_xp: number
  final_attacker_hp: number
  final_defender_hp: number
  new_season_score: number
  score_milestone_crossed: boolean
  idempotent?: boolean
}
