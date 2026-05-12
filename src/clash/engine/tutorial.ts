// Day 25 — Tutorial decision policy.
//
// Plays the role of `aiDecide` for the tutorial match. Instead of an
// adversarial AI, it spawns *one* goblin near the enemy left bridge so
// the player has an active threat to react to, then stays silent — the
// rest of the match is the player walking themselves through deploy +
// attack against the enemy_left princess.
//
// The match's win condition still flows through tick.ts (king dies →
// state.result = 'win'); ClashMatch's tutorial branch additionally
// watches enemy_left.hp and exits to TutorialResult when it falls.

import type { Action, MatchState } from './types'

export interface TutorialScript {
  /** Tick at which the lone goblin spawns. tick = elapsed * tickHz. */
  spawnGoblinAt: number
  /** Princess tower the player must destroy to "complete" the tutorial. */
  targetPrincess: 'enemy_left' | 'enemy_right'
}

export const DEFAULT_TUTORIAL_SCRIPT: TutorialScript = {
  spawnGoblinAt: 30, // 1 second into the match
  targetPrincess: 'enemy_left',
}

/**
 * Tutorial replacement for `aiDecide`. The enemy deploys exactly one
 * goblin near its left bridge as a warm-up target, then never acts again.
 */
export function tutorialDecide(
  state: MatchState,
  script: TutorialScript = DEFAULT_TUTORIAL_SCRIPT,
): Action | null {
  if (state.tick !== script.spawnGoblinAt) return null
  // The enemy hand is pre-loaded with deck cards. We can spawn from any
  // hand index; the engine validates elixir + position itself.
  const handIndex = state.enemy.hand.pile.findIndex((id) => id === 'goblin')
  if (handIndex === -1) {
    // Tutorial deck didn't include goblin — fall back to whatever the
    // first hand slot has so the encounter still kicks off.
    return {
      kind: 'deploy',
      side: 'enemy',
      handIndex: 0,
      pos: { x: 3, y: 22 },
    }
  }
  return {
    kind: 'deploy',
    side: 'enemy',
    handIndex,
    pos: { x: 3, y: 22 },
  }
}

/**
 * Tutorial-completion predicate: the targeted enemy princess tower fell.
 * Independent of the engine's `result` field (which only flips for kings).
 */
export function tutorialIsComplete(
  state: MatchState,
  script: TutorialScript = DEFAULT_TUTORIAL_SCRIPT,
): boolean {
  const target = state.towers.find((t) => t.id === script.targetPrincess)
  return !!target && target.hp <= 0
}

/**
 * Tutorial-decision-delay shim: the engine's regular `nextDecisionDelay`
 * scales with difficulty/elixir; for tutorial we just hold at "very soon"
 * until the spawn fires, then go silent.
 */
export function tutorialNextDelay(state: MatchState): number {
  if (state.tick < DEFAULT_TUTORIAL_SCRIPT.spawnGoblinAt) return 0.05
  return 1e9 // effectively never act again
}
