// Pixi.js v8 battlefield render layer (Day 22 + Day 23).
//
// Day 22 introduced the canvas + entity reconciliation; Day 23 swaps the
// placeholder circles for AI-generated sprite atlases and adds procedural
// tweens (idle bob / walk swing / attack thrust / death fade). When a
// card's atlas is missing the renderer falls back to the original circle.
//
// Engine state is mutated in place (see useClashEngine), so we sync each
// prop into a ref on every render and the Pixi ticker reads from those
// refs. This avoids stale closures while honoring the mutate-in-place
// contract.

import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { ARENA, isKingTower, type TowerId } from '@/clash/lib/arena'
import type { MatchState, Unit, UnitState } from '@/clash/engine/types'
import type { CrCardId } from '@/clash/lib/cardData'
import { boardToPixel, canvasSize, type CanvasSize } from '@/clash/render/coords'
import { useClashAssets } from '@/clash/hooks/useClashAssets'
import {
  applyAttackThrust,
  applyDeathFade,
  applyIdleBob,
  applySpawnRise,
  applyWalkSwing,
} from '@/clash/render/spriteTween'

interface Props {
  state: MatchState
  showDeployZone: boolean
  dragPreview: { cardId: string; emoji: string; pos: { x: number; y: number } } | null
  /** Union of card ids that can appear in the match (player deck ∪ enemy deck). */
  cardIds: readonly CrCardId[]
}

const COL_BG = 0x0a0e1a
const COL_GRID = 0xffffff
const COL_RIVER = 0x3c8cff
const COL_BRIDGE = 0xb37050
const COL_PLAYER = 0xb6ff3c
const COL_ENEMY = 0xff3c70
const COL_KING = 0xffd23c
const COL_DEPLOY = 0xb6ff3c

const FPS_FLOOR = 45
const FPS_LOW_FRAMES = 60
const FPS_CAP_DEGRADED = 30

const STATE_TO_FRAME: Record<UnitState, 'idle' | 'walk' | 'attack' | 'death'> = {
  spawning: 'idle',
  walking: 'walk',
  attacking: 'attack',
  dying: 'death',
  dead: 'death',
}

interface UnitNodeRefs {
  container: PIXI.Container
  ring: PIXI.Graphics
  body: PIXI.Container
  hpFill: PIXI.Graphics
  hpBgWidth: number
  /** Last frame name applied to `body.sprite.texture` — used to skip texture writes. */
  lastFrame: 'idle' | 'walk' | 'attack' | 'death' | null
  /** Sprite vs placeholder. */
  hasSprite: boolean
}

export default function PixiBattlefield({
  state,
  showDeployZone,
  dragPreview,
  cardIds,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load atlases here so pixi.js stays inside this lazy chunk and never
  // pollutes the dashboard bundle.
  const { atlases } = useClashAssets(cardIds)

  const stateRef = useRef(state)
  stateRef.current = state
  const dragRef = useRef(dragPreview)
  dragRef.current = dragPreview
  const showDeployRef = useRef(showDeployZone)
  showDeployRef.current = showDeployZone
  const atlasRef = useRef(atlases)
  atlasRef.current = atlases

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    let disposed = false
    const app = new PIXI.Application()
    const unitMap = new Map<string, UnitNodeRefs>()
    const towerMap = new Map<string, PIXI.Container>()
    let size: CanvasSize = { w: 0, h: 0 }
    let degraded = false
    let fpsLowFrames = 0

    let gridLayer: PIXI.Graphics
    let riverLayer: PIXI.Graphics
    let bridgeLayer: PIXI.Graphics
    let deployLayer: PIXI.Graphics
    let towerLayer: PIXI.Container
    let unitLayer: PIXI.Container
    let dragLayer: PIXI.Container

    const drawStaticScene = () => {
      const cell = size.w / ARENA.cols

      gridLayer.clear()
      for (let x = 0; x <= ARENA.cols; x++) {
        gridLayer.moveTo(x * cell, 0).lineTo(x * cell, size.h)
      }
      for (let y = 0; y <= ARENA.rows; y++) {
        gridLayer.moveTo(0, y * cell).lineTo(size.w, y * cell)
      }
      gridLayer.stroke({ color: COL_GRID, alpha: 0.04, width: 1 })

      riverLayer.clear()
      const riverTopPx = boardToPixel({ x: 0, y: ARENA.river.yMax + 1 }, size).y
      const riverBotPx = boardToPixel({ x: 0, y: ARENA.river.yMin }, size).y
      riverLayer
        .rect(0, riverTopPx, size.w, riverBotPx - riverTopPx)
        .fill({ color: COL_RIVER, alpha: 0.25 })

      bridgeLayer.clear()
      for (const b of ARENA.bridges) {
        const bx = (b.x / ARENA.cols) * size.w
        const bw = cell * 1.4
        bridgeLayer
          .rect(bx - bw / 2, riverTopPx, bw, riverBotPx - riverTopPx)
          .fill({ color: COL_BRIDGE, alpha: 0.6 })
      }

      for (const id of Object.keys(ARENA.towers) as TowerId[]) {
        if (towerMap.has(id)) continue
        const node = makeTowerNode(id, cell)
        towerMap.set(id, node)
        towerLayer.addChild(node)
      }
      for (const tw of stateRef.current?.towers ?? []) {
        const node = towerMap.get(tw.id)
        if (!node) continue
        const px = boardToPixel(tw.pos, size)
        node.position.set(px.x, px.y)
      }
    }

    const makeTowerNode = (id: TowerId, cell: number): PIXI.Container => {
      const node = new PIXI.Container()
      const side = id.startsWith('player') ? 'player' : 'enemy'
      const sideColor = side === 'player' ? COL_PLAYER : COL_ENEMY
      const tint = isKingTower(id) ? COL_KING : sideColor
      const sizePx = isKingTower(id) ? cell * 2.2 : cell * 1.8

      const body = new PIXI.Graphics()
        .rect(-sizePx / 2, -sizePx / 2, sizePx, sizePx)
        .fill({ color: tint, alpha: 0.25 })
        .stroke({ color: tint, width: 2, alpha: 0.85 })
      node.addChild(body)

      const hpBg = new PIXI.Graphics()
        .rect(-sizePx / 2, -sizePx / 2 - 6, sizePx, 3)
        .fill({ color: 0x000000, alpha: 0.5 })
      const hpFill = new PIXI.Graphics()
        .rect(-sizePx / 2, -sizePx / 2 - 6, sizePx, 3)
        .fill({ color: tint })
      hpFill.label = 'hpFill'
      ;(node as PIXI.Container & { __hpWidth?: number }).__hpWidth = sizePx
      node.addChild(hpBg, hpFill)
      return node
    }

    const makeUnitNode = (
      cell: number,
      side: 'player' | 'enemy',
      cardId: CrCardId,
    ): UnitNodeRefs => {
      const container = new PIXI.Container()
      const sideColor = side === 'player' ? COL_PLAYER : COL_ENEMY

      // Side identification ring underneath, so you can tell teams even if
      // sprite features are ambiguous at small sizes.
      const ringSize = cell * 1.05
      const ring = new PIXI.Graphics()
        .circle(0, 0, ringSize / 2)
        .stroke({ color: sideColor, width: 2, alpha: 0.85 })
        .fill({ color: sideColor, alpha: 0.12 })

      // Body — sprite if atlas is loaded for this card, placeholder circle otherwise.
      const sheet = atlasRef.current?.get(cardId)
      const idleTex = sheet?.textures?.idle
      let body: PIXI.Container
      let hasSprite = false
      if (idleTex) {
        const sprite = new PIXI.Sprite(idleTex)
        sprite.anchor.set(0.5, 0.55)
        const drawSize = cell * 1.5
        sprite.width = drawSize
        sprite.height = drawSize
        body = sprite
        hasSprite = true
      } else {
        const placeholder = new PIXI.Graphics()
          .circle(0, 0, cell * 0.4)
          .fill({ color: sideColor, alpha: 0.85 })
          .stroke({ color: 0x000000, width: 1.5, alpha: 0.6 })
        body = placeholder
      }
      body.label = 'body'

      const hpBgWidth = cell * 1.0
      const hpBg = new PIXI.Graphics()
        .rect(-hpBgWidth / 2, -hpBgWidth / 2 - 6, hpBgWidth, 2.5)
        .fill({ color: 0x000000, alpha: 0.6 })
      const hpFill = new PIXI.Graphics()
        .rect(-hpBgWidth / 2, -hpBgWidth / 2 - 6, hpBgWidth, 2.5)
        .fill({ color: sideColor })
      hpFill.label = 'hpFill'

      container.addChild(ring, body, hpBg, hpFill)
      return {
        container,
        ring,
        body,
        hpFill,
        hpBgWidth,
        lastFrame: hasSprite ? 'idle' : null,
        hasSprite,
      }
    }

    const drawDeployZone = () => {
      deployLayer.clear()
      if (!showDeployRef.current) return
      const s = stateRef.current
      if (!s) return
      const enemyLeftAlive = (s.towers.find((t) => t.id === 'enemy_left')?.hp ?? 0) > 0
      const enemyRightAlive = (s.towers.find((t) => t.id === 'enemy_right')?.hp ?? 0) > 0

      const yMaxPx = boardToPixel({ x: 0, y: ARENA.playerDeployYMax }, size).y
      deployLayer.rect(0, yMaxPx, size.w, size.h - yMaxPx).fill({ color: COL_DEPLOY, alpha: 0.08 })

      if (!enemyLeftAlive) {
        const halfY = boardToPixel({ x: 0, y: ARENA.river.yMax }, size).y
        deployLayer.rect(0, 0, size.w / 2, halfY).fill({ color: COL_DEPLOY, alpha: 0.06 })
      }
      if (!enemyRightAlive) {
        const halfY = boardToPixel({ x: 0, y: ARENA.river.yMax }, size).y
        deployLayer
          .rect(size.w / 2, 0, size.w / 2, halfY)
          .fill({ color: COL_DEPLOY, alpha: 0.06 })
      }
    }

    const drawDragPreview = () => {
      dragLayer.removeChildren()
      const dp = dragRef.current
      if (!dp) return
      const px = boardToPixel(dp.pos, size)
      const cell = size.w / ARENA.cols
      const ring = new PIXI.Graphics()
        .circle(0, 0, cell * 0.9)
        .fill({ color: COL_PLAYER, alpha: 0.3 })
        .stroke({ color: COL_PLAYER, width: 2 })
      ring.position.set(px.x, px.y)
      dragLayer.addChild(ring)
      const text = new PIXI.Text({
        text: dp.emoji,
        style: { fontSize: cell * 1.2, align: 'center' },
      })
      text.anchor.set(0.5)
      text.position.set(px.x, px.y)
      dragLayer.addChild(text)
    }

    const reconcileTowers = () => {
      const s = stateRef.current
      if (!s) return
      for (const tw of s.towers) {
        const node = towerMap.get(tw.id) as
          | (PIXI.Container & { __hpWidth?: number })
          | undefined
        if (!node) continue
        const px = boardToPixel(tw.pos, size)
        node.position.set(px.x, px.y)
        const hpFill = node.getChildByLabel('hpFill') as PIXI.Graphics | null
        if (hpFill) {
          const ratio = Math.max(0, tw.hp / tw.maxHp)
          hpFill.scale.x = ratio
        }
        node.alpha = tw.hp > 0 ? 1 : 0.25
      }
    }

    const tweenForUnit = (refs: UnitNodeRefs, u: Unit, now: number) => {
      switch (u.state) {
        case 'spawning': {
          const total = ARENA.spawnFreezeSec
          const progress = total > 0 ? 1 - u.stateTimer / total : 1
          applySpawnRise(refs.body, progress)
          break
        }
        case 'walking':
          applyWalkSwing(refs.body, now)
          break
        case 'attacking':
          applyAttackThrust(refs.body, now, 0, u.attackCooldown)
          break
        case 'dying': {
          const total = ARENA.deathFadeSec
          const progress = total > 0 ? 1 - u.stateTimer / total : 1
          applyDeathFade(refs.body, progress)
          break
        }
        case 'dead':
          applyDeathFade(refs.body, 1)
          break
        default:
          applyIdleBob(refs.body, now)
      }
    }

    const reconcileUnits = (now: number) => {
      const s = stateRef.current
      if (!s) return
      const cell = size.w / ARENA.cols
      const seen = new Set<string>()
      for (const u of s.units) {
        seen.add(u.id)
        let refs = unitMap.get(u.id)
        // Promote placeholder → sprite once atlas finishes loading mid-match.
        if (refs && !refs.hasSprite && atlasRef.current?.get(u.cardId)?.textures?.idle) {
          refs.container.destroy({ children: true })
          unitMap.delete(u.id)
          refs = undefined
        }
        if (!refs) {
          refs = makeUnitNode(cell, u.side, u.cardId)
          unitMap.set(u.id, refs)
          unitLayer.addChild(refs.container)
        }
        const px = boardToPixel(u.pos, size)
        refs.container.position.set(px.x, px.y)

        // Swap sprite frame when state changed, if we have a sheet.
        if (refs.hasSprite) {
          const wanted = STATE_TO_FRAME[u.state]
          if (wanted !== refs.lastFrame) {
            const sheet = atlasRef.current?.get(u.cardId)
            const tex = sheet?.textures?.[wanted]
            if (tex && refs.body instanceof PIXI.Sprite) {
              refs.body.texture = tex
              refs.lastFrame = wanted
            }
          }
        }

        // HP bar.
        const ratio = Math.max(0, u.hp / u.maxHp)
        refs.hpFill.scale.x = ratio

        tweenForUnit(refs, u, now)

        // Side ring stays full alpha while alive — dim once dying.
        refs.ring.alpha = u.state === 'dying' || u.state === 'dead' ? 0.3 : 1
      }
      for (const [id, refs] of unitMap) {
        if (!seen.has(id)) {
          refs.container.destroy({ children: true })
          unitMap.delete(id)
        }
      }
    }

    const onTick = () => {
      if (disposed) return
      const now = performance.now()
      reconcileTowers()
      reconcileUnits(now)
      drawDeployZone()
      drawDragPreview()

      if (!degraded) {
        if (app.ticker.FPS < FPS_FLOOR) fpsLowFrames++
        else fpsLowFrames = 0
        if (fpsLowFrames > FPS_LOW_FRAMES) {
          degraded = true
          app.ticker.maxFPS = FPS_CAP_DEGRADED
        }
      }
    }

    const init = async () => {
      const rect = wrapper.getBoundingClientRect()
      size = canvasSize({ w: rect.width || 360, h: rect.height || 640 })
      await app.init({
        canvas,
        width: size.w,
        height: size.h,
        background: COL_BG,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      if (disposed) {
        app.destroy(true)
        return
      }

      gridLayer = new PIXI.Graphics()
      riverLayer = new PIXI.Graphics()
      bridgeLayer = new PIXI.Graphics()
      deployLayer = new PIXI.Graphics()
      towerLayer = new PIXI.Container()
      unitLayer = new PIXI.Container()
      dragLayer = new PIXI.Container()
      app.stage.addChild(
        gridLayer,
        riverLayer,
        bridgeLayer,
        deployLayer,
        towerLayer,
        unitLayer,
        dragLayer,
      )

      drawStaticScene()
      app.ticker.add(onTick)
    }

    const ro = new ResizeObserver(() => {
      if (disposed) return
      const r = wrapper.getBoundingClientRect()
      const next = canvasSize({ w: r.width, h: r.height })
      if (next.w === size.w && next.h === size.h) return
      size = next
      app.renderer.resize(next.w, next.h)
      for (const refs of unitMap.values()) refs.container.destroy({ children: true })
      unitMap.clear()
      for (const node of towerMap.values()) node.destroy({ children: true })
      towerMap.clear()
      drawStaticScene()
    })

    init().then(() => {
      if (!disposed) ro.observe(wrapper)
    })

    return () => {
      disposed = true
      ro.disconnect()
      app.ticker?.remove(onTick)
      app.destroy(true, { children: true, texture: false })
      unitMap.clear()
      towerMap.clear()
    }
  }, [])

  return (
    <div
      data-battlefield
      ref={wrapperRef}
      className="relative w-full mx-auto bg-bg-primary border border-white/15 rounded-card overflow-hidden select-none touch-none"
      style={{ aspectRatio: '9 / 16', maxWidth: 'min(420px, 100%)' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
