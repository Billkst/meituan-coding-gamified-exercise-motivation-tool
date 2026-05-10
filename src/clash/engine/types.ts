// Clash engine types — shared by tick reducer, unit FSM, AI, rendering.

import type { CrCardId, CrTargetType } from '@/clash/lib/cardData'
import type { Side, TowerId } from '@/clash/lib/arena'

export type UnitState = 'spawning' | 'walking' | 'attacking' | 'dying' | 'dead'

export interface Vec2 {
  x: number
  y: number
}

/**
 * A unit on the battlefield. Spells are applied immediately in damage.ts and
 * never become Units; buildings ARE units (immobile).
 */
export interface Unit {
  id: string
  side: Side
  cardId: CrCardId
  pos: Vec2
  hp: number
  maxHp: number
  state: UnitState
  /** Seconds remaining in the current state (spawn freeze, attack windup, death fade). */
  stateTimer: number
  /** Cooldown in seconds before the next attack can fire. */
  attackCooldown: number
  /** Resolved card stats at this unit's level (level scaled). */
  stats: ResolvedStats
  /** id of the current target (unit or tower); null if searching. */
  targetId: string | null
  /** lane the unit committed to ('left' or 'right'); null for buildings/spells. */
  lane: 'left' | 'right' | null
  isBuilding: boolean
  isAir: boolean
}

export interface ResolvedStats {
  hp: number
  dmg: number
  hitSpeed: number
  moveSpeed: number
  range: number
  target: CrTargetType
  /** > 0 means splash radius around target. */
  splashRadius: number
}

/**
 * A tower mirrors Unit but never moves and respects king-tower-activated rules.
 */
export interface Tower {
  id: TowerId
  side: Side
  pos: Vec2
  hp: number
  maxHp: number
  range: number
  hitSpeed: number
  attackCooldown: number
  /** King towers start dormant; activated when a princess on their side falls (or king is hit directly). */
  isActive: boolean
  isKing: boolean
  targetId: string | null
}

/**
 * A floating damage popup (UI-only, but produced by tick so the renderer can read it).
 * Lives for ~700ms.
 */
export interface DamageEvent {
  id: string
  pos: Vec2
  amount: number
  /** Color hint for the renderer. */
  kind: 'normal' | 'crit' | 'tower'
  ttl: number
}

/**
 * Side-effect log entries the renderer can subscribe to (for sounds, screen shake, etc.).
 */
export type LogEntry =
  | { t: 'deploy'; side: Side; cardId: CrCardId; pos: Vec2; tick: number }
  | { t: 'spell'; side: Side; cardId: CrCardId; pos: Vec2; tick: number }
  | { t: 'attack'; attackerId: string; targetId: string; dmg: number; tick: number }
  | { t: 'tower_destroyed'; towerId: TowerId; tick: number }
  | { t: 'unit_died'; unitId: string; tick: number }

export type MatchPhase =
  | 'pregame'      // pre-battle countdown 3..2..1
  | 'main'         // 0-180s
  | 'overtime'     // 180-240s, double elixir
  | 'ended'        // someone broke a king OR overtime expired

/**
 * 8-card rolling pile (Clash Royale rotation).
 *   pile[0..3] = current 4-card hand (handIndex 0..3)
 *   pile[4]    = next-card preview
 *   pile[5..7] = queued behind the preview
 *
 * After playing handIndex H: splice(H, 1) then push to the end. This
 * automatically advances the preview into the freed hand slot.
 */
export interface PlayerHand {
  pile: CrCardId[]
}

export interface ElixirState {
  current: number
  /** Accumulated fractional elixir; integer overflow flushes to current. */
  partial: number
}

export interface MatchState {
  tick: number
  /** Wall-clock seconds since match start. */
  elapsed: number
  phase: MatchPhase
  units: Unit[]
  towers: Tower[]
  player: { hand: PlayerHand; elixir: ElixirState; towersLost: number }
  enemy: { hand: PlayerHand; elixir: ElixirState; towersLost: number }
  damageEvents: DamageEvent[]
  log: LogEntry[]
  result: 'win' | 'loss' | 'draw' | null
  difficulty: 'easy' | 'normal' | 'hard'
  /** Monotonic id source for spawned units / damage events. */
  nextId: number
}

/**
 * External actions the renderer / AI can dispatch into the reducer.
 * The reducer applies them at the start of each tick before physics.
 */
export type Action =
  | { kind: 'deploy'; side: Side; handIndex: number; pos: Vec2 }
  | { kind: 'tick'; dtSec: number }

/**
 * Initial deck content provided when starting a match. Both sides supply the
 * 8 ids and per-card level (so AI matches player's progression strength roughly).
 */
export interface DeckLoadout {
  cardIds: CrCardId[]
  levels: Record<CrCardId, number>
}

export interface StartMatchInput {
  player: DeckLoadout
  enemy: DeckLoadout
  difficulty: 'easy' | 'normal' | 'hard'
  /** RNG seed for hand-shuffle reproducibility (used in tests + replay). */
  seed?: number
}
