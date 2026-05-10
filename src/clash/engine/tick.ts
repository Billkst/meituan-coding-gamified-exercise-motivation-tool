// Clash match reducer — pure-ish (mutates a draft passed by ref).
// External entrypoints:
//   initMatch(input) → MatchState
//   applyAction(state, action, rng) → MatchState  (returns the same ref, mutated)
//
// The reducer is split into small step functions per concern (elixir, units, towers, deploy).

import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import { ARENA, type Side, type TowerId, isKingTower, towerSide } from '@/clash/lib/arena'
import { applyAttack, applySpell } from './damage'
import { defaultMarchTarget, nextWaypoint, stepToward } from './pathfinding'
import { getTargetPos, pickTarget } from './targeting'
import { spawnUnits, dist } from './unit'
import { shuffle } from './rng'
import type {
  Action,
  ElixirState,
  LogEntry,
  MatchPhase,
  MatchState,
  PlayerHand,
  StartMatchInput,
  Tower,
  Unit,
} from './types'

// =============================================================================
// Init
// =============================================================================

export function initMatch(input: StartMatchInput, rng: () => number): MatchState {
  const towers: Tower[] = (Object.keys(ARENA.towers) as TowerId[]).map((id) => {
    const def = ARENA.towers[id]
    return {
      id,
      side: towerSide(id),
      pos: { x: def.x, y: def.y },
      hp: def.hp,
      maxHp: def.hp,
      range: def.range,
      hitSpeed: def.hitSpeed,
      attackCooldown: 0,
      isKing: isKingTower(id),
      isActive: !isKingTower(id),
      targetId: null,
    }
  })

  return {
    tick: 0,
    elapsed: 0,
    phase: 'main',
    units: [],
    towers,
    player: {
      hand: { pile: shuffle(input.player.cardIds, rng) },
      elixir: { current: ARENA.elixirStart, partial: 0 },
      towersLost: 0,
    },
    enemy: {
      hand: { pile: shuffle(input.enemy.cardIds, rng) },
      elixir: { current: ARENA.elixirStart, partial: 0 },
      towersLost: 0,
    },
    damageEvents: [],
    log: [],
    result: null,
    difficulty: input.difficulty,
    nextId: 1,
  }
}

// =============================================================================
// Top-level apply
// =============================================================================

export function applyAction(
  state: MatchState,
  action: Action,
  rng: () => number,
  levels: { player: Record<CrCardId, number>; enemy: Record<CrCardId, number> },
): MatchState {
  if (state.phase === 'ended') return state

  if (action.kind === 'deploy') {
    applyDeploy(state, action.side, action.handIndex, action.pos, levels, rng)
    return state
  }
  // tick
  return stepTick(state, action.dtSec, levels)
}

// =============================================================================
// Deploy
// =============================================================================

function playFromPile(hand: PlayerHand, handIndex: number): CrCardId | null {
  if (handIndex < 0 || handIndex > 3) return null
  const card = hand.pile[handIndex]
  if (!card) return null
  hand.pile.splice(handIndex, 1)
  hand.pile.push(card)
  return card
}

function applyDeploy(
  state: MatchState,
  side: Side,
  handIndex: number,
  pos: { x: number; y: number },
  levels: { player: Record<CrCardId, number>; enemy: Record<CrCardId, number> },
  _rng: () => number,
): boolean {
  const player = side === 'player' ? state.player : state.enemy
  const cardId = player.hand.pile[handIndex]
  if (!cardId) return false
  const def = CR_CARDS_BY_ID[cardId]
  if (!def) return false
  if (player.elixir.current < def.cost) return false

  // Commit
  player.elixir.current -= def.cost
  playFromPile(player.hand, handIndex)
  const level = (side === 'player' ? levels.player : levels.enemy)[cardId] ?? 1

  if (def.card_type === 'spell') {
    state.log.push({ t: 'spell', side, cardId, pos, tick: state.tick })
    applySpell(state, cardId, level, side, pos)
    return true
  }

  // Troop or building → spawn
  state.log.push({ t: 'deploy', side, cardId, pos, tick: state.tick })
  const newUnits = spawnUnits({
    cardId,
    side,
    pos,
    level,
    startId: state.nextId,
  })
  state.nextId += newUnits.length
  state.units.push(...newUnits)
  return true
}

// =============================================================================
// Per-tick simulation
// =============================================================================

function stepTick(
  state: MatchState,
  dtSec: number,
  levels: { player: Record<CrCardId, number>; enemy: Record<CrCardId, number> },
): MatchState {
  state.tick++
  state.elapsed += dtSec
  void levels // accepted for symmetry; unit stats already resolved at spawn time

  updatePhase(state)
  regenerateElixir(state.player.elixir, state.phase, dtSec)
  regenerateElixir(state.enemy.elixir, state.phase, dtSec)

  for (const u of state.units) stepUnit(state, u, dtSec)
  for (const t of state.towers) stepTower(state, t, dtSec)

  cullDead(state)
  decayDamageEvents(state, dtSec)
  resolveTowerDeaths(state)
  resolveEndConditions(state)

  return state
}

function updatePhase(state: MatchState) {
  const t = state.elapsed
  let phase: MatchPhase = state.phase
  if (t >= ARENA.matchSeconds + ARENA.overtimeSeconds) phase = 'ended'
  else if (t >= ARENA.matchSeconds) phase = 'overtime'
  else phase = 'main'
  state.phase = phase
}

function regenerateElixir(e: ElixirState, phase: MatchPhase, dtSec: number) {
  if (phase === 'ended') return
  const rate =
    phase === 'overtime' ? ARENA.elixirRateOvertimePerSec : ARENA.elixirRateNormalPerSec
  e.partial += rate * dtSec
  while (e.partial >= 1 && e.current < ARENA.elixirMaxNormal) {
    e.partial -= 1
    e.current = Math.min(ARENA.elixirMaxNormal, e.current + 1)
  }
  if (e.current >= ARENA.elixirMaxNormal) e.partial = 0
}

// -----------------------------------------------------------------------------
// Unit step
// -----------------------------------------------------------------------------

function stepUnit(state: MatchState, unit: Unit, dtSec: number) {
  // State timer always counts down.
  unit.stateTimer = Math.max(0, unit.stateTimer - dtSec)
  unit.attackCooldown = Math.max(0, unit.attackCooldown - dtSec)

  if (unit.hp <= 0 && unit.state !== 'dying' && unit.state !== 'dead') {
    unit.state = 'dying'
    unit.stateTimer = ARENA.deathFadeSec
    state.log.push({ t: 'unit_died', unitId: unit.id, tick: state.tick })
    return
  }

  if (unit.state === 'spawning') {
    if (unit.stateTimer <= 0) {
      unit.state = 'walking'
    }
    return
  }
  if (unit.state === 'dying') {
    if (unit.stateTimer <= 0) unit.state = 'dead'
    return
  }
  if (unit.state === 'dead') return

  // Validate / re-pick target.
  const targetPos = unit.targetId ? getTargetPos(state, unit.targetId) : null
  if (!targetPos) {
    unit.targetId = pickTarget(state, unit)
  }

  if (!unit.targetId) {
    // No target → march toward default.
    const wp = nextWaypoint(unit, defaultMarchTarget(unit))
    unit.state = 'walking'
    if (!unit.isBuilding) unit.pos = stepToward(unit, wp, dtSec)
    return
  }

  const tPos = getTargetPos(state, unit.targetId)!
  const distance = dist(unit.pos, tPos)

  if (distance <= unit.stats.range + 0.1) {
    // In range → attack.
    if (unit.attackCooldown <= 0) {
      unit.state = 'attacking'
      const out = applyAttack(state, unit, unit.targetId)
      state.log.push({
        t: 'attack',
        attackerId: unit.id,
        targetId: unit.targetId,
        dmg: out.primaryDamage,
        tick: state.tick,
      })
      unit.attackCooldown = unit.stats.hitSpeed
      if (out.primaryDied) unit.targetId = null
    }
    return
  }

  // Out of range → walk.
  unit.state = 'walking'
  if (!unit.isBuilding) {
    const wp = nextWaypoint(unit, tPos)
    unit.pos = stepToward(unit, wp, dtSec)
  }
}

// -----------------------------------------------------------------------------
// Tower step
// -----------------------------------------------------------------------------

function stepTower(state: MatchState, tower: Tower, _dtSec: number) {
  if (tower.hp <= 0) return
  if (tower.isKing && !tower.isActive) return

  tower.attackCooldown = Math.max(0, tower.attackCooldown - _dtSec)

  // Validate target.
  const tPos = tower.targetId ? getTargetPos(state, tower.targetId) : null
  if (!tPos) {
    // Pick closest live enemy unit in range.
    const enemySide: Side = tower.side === 'player' ? 'enemy' : 'player'
    let bestId: string | null = null
    let bestDist = Infinity
    for (const u of state.units) {
      if (u.side !== enemySide) continue
      if (u.hp <= 0) continue
      const d = dist(tower.pos, u.pos)
      if (d <= tower.range && d < bestDist) {
        bestDist = d
        bestId = u.id
      }
    }
    tower.targetId = bestId
  }

  if (!tower.targetId) return

  const finalPos = getTargetPos(state, tower.targetId)
  if (!finalPos) {
    tower.targetId = null
    return
  }
  const d = dist(tower.pos, finalPos)
  if (d > tower.range) {
    tower.targetId = null
    return
  }

  if (tower.attackCooldown <= 0) {
    // Towers always do single-target hit. Damage value = 100 (princess) / 90 (king).
    const baseDmg = tower.isKing ? 90 : 100
    const target = state.units.find((u) => u.id === tower.targetId)
    if (target) {
      const taken = Math.min(target.hp, baseDmg)
      target.hp -= taken
      state.damageEvents.push({
        id: `d_${state.nextId++}`,
        pos: { ...target.pos },
        amount: taken,
        kind: 'tower',
        ttl: 0.7,
      })
      state.log.push({
        t: 'attack',
        attackerId: tower.id,
        targetId: target.id,
        dmg: taken,
        tick: state.tick,
      })
    }
    tower.attackCooldown = tower.hitSpeed
  }
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

function cullDead(state: MatchState) {
  state.units = state.units.filter((u) => u.state !== 'dead')
}

function decayDamageEvents(state: MatchState, dtSec: number) {
  for (const e of state.damageEvents) e.ttl -= dtSec
  state.damageEvents = state.damageEvents.filter((e) => e.ttl > 0)
}

function resolveTowerDeaths(state: MatchState) {
  for (const tower of state.towers) {
    if (tower.hp > 0) continue
    // Once dead, log + activate own king if a princess fell.
    const alreadyLogged = state.log.some(
      (e) => e.t === 'tower_destroyed' && e.towerId === tower.id,
    )
    if (alreadyLogged) continue
    state.log.push({ t: 'tower_destroyed', towerId: tower.id, tick: state.tick })
    if (tower.side === 'player') state.player.towersLost++
    else state.enemy.towersLost++

    if (!tower.isKing) {
      // Activate own king if a princess on this side fell.
      const ownKing = state.towers.find(
        (t) => t.side === tower.side && t.isKing,
      )
      if (ownKing) ownKing.isActive = true
    }
  }
}

function resolveEndConditions(state: MatchState) {
  const playerKing = state.towers.find((t) => t.id === 'player_king')!
  const enemyKing = state.towers.find((t) => t.id === 'enemy_king')!

  if (playerKing.hp <= 0) {
    state.phase = 'ended'
    state.result = 'loss'
    return
  }
  if (enemyKing.hp <= 0) {
    state.phase = 'ended'
    state.result = 'win'
    return
  }
  if (state.elapsed >= ARENA.matchSeconds + ARENA.overtimeSeconds) {
    // Time's up — settle by towers + king HP.
    state.phase = 'ended'
    if (state.player.towersLost < state.enemy.towersLost) state.result = 'win'
    else if (state.player.towersLost > state.enemy.towersLost) state.result = 'loss'
    else if (playerKing.hp > enemyKing.hp) state.result = 'win'
    else if (playerKing.hp < enemyKing.hp) state.result = 'loss'
    else state.result = 'draw'
  }
}

// =============================================================================
// Helpers used by callers (renderer / hook) outside the reducer
// =============================================================================

export function summarizeLog(log: LogEntry[]): LogEntry[] {
  return log.slice(-200) // cap for memory
}
