// Pixi.js v8 battlefield render layer (Day 22).
//
// Day 22 ships *placeholder* sprites — flat side-tinted rectangles + emoji
// fallback drawn with PIXI.Text. Day 23 swaps in real WebP sprites from the
// gpt-image-2 pipeline. The render contract here is sprite reconciliation:
// one Map<unitId, Container> + one Map<towerId, Container>, diffed every
// tick against the engine's mutated MatchState.
//
// Engine state is mutated in place (see useClashEngine), so we sync the
// prop into a ref on every render and the ticker reads from the ref. This
// avoids stale closures while still respecting the engine's mutate-in-place
// contract.

import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { ARENA, isKingTower, type TowerId } from '@/clash/lib/arena'
import type { MatchState } from '@/clash/engine/types'
import { boardToPixel, canvasSize, type CanvasSize } from '@/clash/render/coords'

interface Props {
  state: MatchState
  showDeployZone: boolean
  dragPreview: { cardId: string; emoji: string; pos: { x: number; y: number } } | null
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

export default function PixiBattlefield({ state, showDeployZone, dragPreview }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Latest props synced into refs every render so the Pixi ticker (which
  // runs outside React) always reads fresh values.
  const stateRef = useRef(state)
  stateRef.current = state
  const dragRef = useRef(dragPreview)
  dragRef.current = dragPreview
  const showDeployRef = useRef(showDeployZone)
  showDeployRef.current = showDeployZone

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    let disposed = false
    const app = new PIXI.Application()
    const unitMap = new Map<string, PIXI.Container>()
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

      // Tower placeholders are drawn into towerLayer (Containers) so hp bars
      // can ride along.
      for (const id of Object.keys(ARENA.towers) as TowerId[]) {
        if (towerMap.has(id)) continue
        const node = makeTowerNode(id, cell)
        towerMap.set(id, node)
        towerLayer.addChild(node)
      }
      // Initial position.
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

    const makeUnitNode = (cell: number, side: 'player' | 'enemy', isKing: boolean) => {
      const node = new PIXI.Container()
      const tint = isKing ? COL_KING : side === 'player' ? COL_PLAYER : COL_ENEMY
      const sz = cell * 0.85
      const body = new PIXI.Graphics()
        .circle(0, 0, sz / 2)
        .fill({ color: tint, alpha: 0.85 })
        .stroke({ color: 0x000000, width: 1.5, alpha: 0.6 })
      node.addChild(body)
      const hpBg = new PIXI.Graphics()
        .rect(-sz / 2, -sz / 2 - 5, sz, 2)
        .fill({ color: 0x000000, alpha: 0.5 })
      const hpFill = new PIXI.Graphics()
        .rect(-sz / 2, -sz / 2 - 5, sz, 2)
        .fill({ color: tint })
      hpFill.label = 'hpFill'
      ;(node as PIXI.Container & { __hpWidth?: number }).__hpWidth = sz
      node.addChild(hpBg, hpFill)
      return node
    }

    const drawDeployZone = () => {
      deployLayer.clear()
      if (!showDeployRef.current) return
      const s = stateRef.current
      if (!s) return
      const enemyLeftAlive = (s.towers.find((t) => t.id === 'enemy_left')?.hp ?? 0) > 0
      const enemyRightAlive = (s.towers.find((t) => t.id === 'enemy_right')?.hp ?? 0) > 0

      // Player half: y ∈ [0, playerDeployYMax]
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

    const reconcileUnits = () => {
      const s = stateRef.current
      if (!s) return
      const cell = size.w / ARENA.cols
      const seen = new Set<string>()
      for (const u of s.units) {
        seen.add(u.id)
        let node = unitMap.get(u.id) as
          | (PIXI.Container & { __hpWidth?: number })
          | undefined
        if (!node) {
          node = makeUnitNode(cell, u.side, false) as PIXI.Container & { __hpWidth?: number }
          unitMap.set(u.id, node)
          unitLayer.addChild(node)
        }
        const px = boardToPixel(u.pos, size)
        node.position.set(px.x, px.y)
        const hpFill = node.getChildByLabel('hpFill') as PIXI.Graphics | null
        if (hpFill) {
          const ratio = Math.max(0, u.hp / u.maxHp)
          hpFill.scale.x = ratio
        }
        // Dim while spawning / dying.
        node.alpha =
          u.state === 'spawning' ? 0.55 : u.state === 'dying' ? 0.3 : 1
      }
      for (const [id, node] of unitMap) {
        if (!seen.has(id)) {
          node.destroy({ children: true })
          unitMap.delete(id)
        }
      }
    }

    const onTick = () => {
      if (disposed) return
      reconcileTowers()
      reconcileUnits()
      drawDeployZone()
      drawDragPreview()

      // FPS fallback: if avg FPS dips under floor for ~2s, degrade.
      if (!degraded) {
        if (app.ticker.FPS < FPS_FLOOR) fpsLowFrames++
        else fpsLowFrames = 0
        if (fpsLowFrames > FPS_LOW_FRAMES) {
          degraded = true
          app.ticker.maxFPS = FPS_CAP_DEGRADED
          // No particle layer yet (Day 24), so this is a no-op visually for
          // now beyond the FPS cap — but the cap is the load-bearing knob.
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
      if (disposed || !appRef.matches) return
      const r = wrapper.getBoundingClientRect()
      const next = canvasSize({ w: r.width, h: r.height })
      if (next.w === size.w && next.h === size.h) return
      size = next
      app.renderer.resize(next.w, next.h)
      // Re-issue static scene at new scale + bump every sprite size by
      // recreating the node graph (simplest correct path for placeholder
      // shapes; Day 23 sprites can scale themselves cleanly).
      for (const node of unitMap.values()) node.destroy({ children: true })
      unitMap.clear()
      for (const node of towerMap.values()) node.destroy({ children: true })
      towerMap.clear()
      drawStaticScene()
    })

    // appRef.matches is just a truthy sentinel for the type-checker;
    // actual disposed flag is the source of truth.
    const appRef = { matches: true }

    init().then(() => {
      if (!disposed) ro.observe(wrapper)
    })

    return () => {
      disposed = true
      appRef.matches = false
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
