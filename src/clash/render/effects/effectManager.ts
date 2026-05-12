// Day 24 — Effect manager. Scans engine log entries each tick and dispatches
// the right visual + audio effect. Tracks the last-seen tick so we never
// re-fire on a re-render.

import type * as PIXI from 'pixi.js'
import type { MatchState, Unit, Tower, LogEntry } from '@/clash/engine/types'
import { boardToPixel, type CanvasSize } from '@/clash/render/coords'
import { emitHitParticles } from './hitParticles'
import { emitProjectile } from './projectile'
import { emitTowerDestroy, triggerScreenShake } from './towerDestroy'
import { emitDeploySmoke } from './deploySmoke'
import { playSound } from '@/clash/audio'

import { PALETTE } from '@/clash/render/palette'

const COL_PLAYER = PALETTE.player
const COL_ENEMY = PALETTE.enemy
const COL_KING = PALETTE.king
const COL_FIRE = PALETTE.fire

const RANGED_THRESHOLD = 2.5 // cells — anything farther than this fires a projectile

interface EffectContext {
  layer: PIXI.Container
  ticker: PIXI.Ticker
  size: CanvasSize
  shakeTarget: HTMLElement | null
}

interface EffectState {
  lastLogTick: number
}

export function createEffectState(): EffectState {
  return { lastLogTick: -1 }
}

const findUnit = (state: MatchState, id: string): Unit | undefined =>
  state.units.find((u) => u.id === id)
const findTower = (state: MatchState, id: string): Tower | undefined =>
  state.towers.find((t) => t.id === id)

const colorForSide = (side: 'player' | 'enemy') =>
  side === 'player' ? COL_PLAYER : COL_ENEMY

const colorForTower = (tower: Tower): number => {
  if (tower.isKing) return COL_KING
  return colorForSide(tower.side)
}

export function scanLogAndEmit(
  state: MatchState,
  ctx: EffectContext,
  efx: EffectState,
) {
  if (!state) return
  const log = state.log
  if (!log.length) return

  // Match restart resets state.tick to 0 — detect that and replay from the
  // start of the new log so the first deploy still fires its smoke puff.
  if (state.tick < efx.lastLogTick) efx.lastLogTick = -1

  for (let i = 0; i < log.length; i++) {
    const entry = log[i]
    if (entry.tick <= efx.lastLogTick) continue
    handleEntry(entry, state, ctx)
  }
  efx.lastLogTick = log[log.length - 1].tick
}

function handleEntry(entry: LogEntry, state: MatchState, ctx: EffectContext) {
  switch (entry.t) {
    case 'deploy': {
      const px = boardToPixel(entry.pos, ctx.size)
      emitDeploySmoke(ctx.layer, ctx.ticker, px, colorForSide(entry.side))
      playSound('unit_deploy')
      break
    }
    case 'attack': {
      const attacker =
        findUnit(state, entry.attackerId) ?? findTower(state, entry.attackerId)
      const targetUnit = findUnit(state, entry.targetId)
      const targetTower = findTower(state, entry.targetId)
      const target = targetUnit ?? targetTower
      if (!target) break

      const fromPx = attacker
        ? boardToPixel(attacker.pos, ctx.size)
        : boardToPixel(target.pos, ctx.size)
      const toPx = boardToPixel(target.pos, ctx.size)

      const distance = attacker
        ? Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y)
        : 0

      const tint = targetUnit
        ? colorForSide(targetUnit.side === 'player' ? 'enemy' : 'player')
        : PALETTE.grid

      if (distance > RANGED_THRESHOLD) {
        // Fireball for baby_dragon, arrow otherwise.
        const kind =
          attacker && 'cardId' in attacker && attacker.cardId === 'baby_dragon'
            ? 'fireball'
            : 'arrow'
        emitProjectile(ctx.layer, ctx.ticker, fromPx, toPx, {
          kind,
          tint: kind === 'fireball' ? COL_FIRE : tint,
        })
      } else {
        emitHitParticles(ctx.layer, ctx.ticker, toPx, tint)
      }
      break
    }
    case 'tower_destroyed': {
      const tw = findTower(state, entry.towerId)
      if (!tw) break
      const px = boardToPixel(tw.pos, ctx.size)
      emitTowerDestroy(ctx.layer, ctx.ticker, px, colorForTower(tw))
      triggerScreenShake(ctx.shakeTarget)
      playSound('tower_destroy')
      break
    }
    case 'spell':
    case 'unit_died':
    default:
      // Engine emits these but the visual story is already told by sprite
      // state changes + the attack-hit particles. Future Day 24+ work can
      // tap them for additional cinematic moments.
      break
  }
}

