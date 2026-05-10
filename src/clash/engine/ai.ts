// AI opponent — picks a card + deploy position when it has enough elixir.
// Pure: takes state + rng, returns an Action or null.

import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import { ARENA } from '@/clash/lib/arena'
import type { Action, MatchState, Vec2 } from './types'

interface DifficultyConfig {
  /** Don't act unless elixir is ≥ this. */
  elixirThreshold: number
  /** Probability of preferring counter-pick (anti-air, defense building, etc.). */
  counterChance: number
  /** Min seconds between decisions (chosen at random in [a, b]). */
  decisionDelayMin: number
  decisionDelayMax: number
}

export const DIFFICULTY_CONFIG: Record<MatchState['difficulty'], DifficultyConfig> = {
  easy: { elixirThreshold: 8, counterChance: 0.3, decisionDelayMin: 1.5, decisionDelayMax: 3.0 },
  normal: { elixirThreshold: 6, counterChance: 0.6, decisionDelayMin: 1.0, decisionDelayMax: 2.0 },
  hard: { elixirThreshold: 4, counterChance: 0.9, decisionDelayMin: 0.5, decisionDelayMax: 1.5 },
}

/**
 * Compute the next decision delay (after a successful action) from rng.
 */
export function nextDecisionDelay(state: MatchState, rng: () => number): number {
  const cfg = DIFFICULTY_CONFIG[state.difficulty]
  return cfg.decisionDelayMin + rng() * (cfg.decisionDelayMax - cfg.decisionDelayMin)
}

/**
 * Decide an enemy action this tick. Returns null when the AI is not ready
 * (insufficient elixir, no playable card, or just choose to wait).
 *
 * Caller is responsible for tracking when to call this (typically every
 * `nextDecisionDelay` seconds). Returns a deploy action if a card fires.
 */
export function aiDecide(state: MatchState, rng: () => number): Action | null {
  const enemy = state.enemy
  const cfg = DIFFICULTY_CONFIG[state.difficulty]

  if (enemy.elixir.current < cfg.elixirThreshold) return null

  // Collect playable hand cards (pile[0..3] = active hand).
  const playable: { handIndex: number; cardId: CrCardId; cost: number }[] = []
  for (let handIndex = 0; handIndex < 4; handIndex++) {
    const cardId = enemy.hand.pile[handIndex]
    const card = cardId ? CR_CARDS_BY_ID[cardId] : null
    if (!card) continue
    if (card.cost <= enemy.elixir.current) {
      playable.push({ handIndex, cardId, cost: card.cost })
    }
  }
  if (playable.length === 0) return null

  // Score each playable card: counter weight + a small randomness.
  const playerHasAir = state.units.some((u) => u.side === 'player' && u.isAir && u.hp > 0)
  const playerNearBridge = state.units.some(
    (u) => u.side === 'player' && u.hp > 0 && u.pos.y > 12 && u.pos.y < 18,
  )
  const playerHeavyTroop = state.units.some(
    (u) => u.side === 'player' && u.hp > 0 && u.maxHp > 1500,
  )

  const scored = playable.map((p) => {
    let score = 1 + rng() * 2
    const card = CR_CARDS_BY_ID[p.cardId]
    if (rng() < cfg.counterChance) {
      // Boost defensive picks if player threatens.
      if (playerHasAir && card.base_stats.target === 'air+ground') score += 5
      if (playerNearBridge && card.card_type === 'building') score += 4
      if (playerHeavyTroop && p.cardId === 'mini_pekka') score += 5
      if (playerHeavyTroop && p.cardId === 'lightning') score += 3
    }
    // Avoid blowing all elixir on small picks late game.
    if (state.phase === 'overtime') score += card.cost * 0.3
    return { ...p, score, card }
  })
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const card = best.card

  // Pick deploy position based on card role.
  let pos: Vec2
  if (card.card_type === 'spell') {
    // Hit player's most threatening cluster.
    const playerUnits = state.units.filter((u) => u.side === 'player' && u.hp > 0)
    if (playerUnits.length === 0) {
      // No units — drop on a player princess tower if low HP, else skip.
      const left = state.towers.find((t) => t.id === 'player_left')
      const right = state.towers.find((t) => t.id === 'player_right')
      const targetTower = (left && right && left.hp < right.hp) ? left : right ?? left
      if (!targetTower || targetTower.hp <= 0) return null
      pos = targetTower.pos
    } else {
      pos = densestCluster(playerUnits.map((u) => u.pos))
    }
  } else if (card.card_type === 'building') {
    // Defensive building behind the bridge on the lane player is pushing.
    const lane = playerNearBridge && state.units.find((u) => u.side === 'player' && u.pos.y > 12)
    const targetX = lane && (lane as { pos: Vec2 }).pos.x < 9 ? 5 : 13
    pos = { x: targetX, y: 22 }
  } else {
    // Troops: aggressive deep behind own king on the open lane.
    const playerLeftAlive = (state.towers.find((t) => t.id === 'enemy_left')?.hp ?? 1) > 0
    const playerRightAlive = (state.towers.find((t) => t.id === 'enemy_right')?.hp ?? 1) > 0
    // Deploy on lane that has an alive own princess (so it's defended).
    const useLeft = playerLeftAlive && (!playerRightAlive || rng() < 0.5)
    pos = { x: useLeft ? 5 : 13, y: 29 }
  }

  return { kind: 'deploy', side: 'enemy', handIndex: best.handIndex, pos }
}

/** Centroid of a small cluster — used by AI to drop spells. */
function densestCluster(positions: Vec2[]): Vec2 {
  if (positions.length === 0) return { x: 9, y: ARENA.rows / 2 }
  // Naive: just centroid (cluster size in our scale is small enough).
  const sum = positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / positions.length, y: sum.y / positions.length }
}
