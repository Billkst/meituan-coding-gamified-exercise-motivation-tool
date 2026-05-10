// 18×32 logical battlefield rendered with CSS aspect-ratio + absolute positioning.
// Coordinate convention: y=0 is the player's side (bottom), y=32 is the enemy's side (top).

import { useMemo } from 'react'
import { ARENA } from '@/clash/lib/arena'
import type { MatchState } from '@/clash/engine/types'
import Unit from './Unit'
import Tower from './Tower'
import DamageNumber from './DamageNumber'

interface Props {
  state: MatchState
  /** Whether to highlight the player deploy zone (during drag). */
  showDeployZone: boolean
  /** Callback when user pointer-up releases over the battlefield. */
  onDeployAt?: (pos: { x: number; y: number }) => void
  /** Live drag preview; null if not dragging. */
  dragPreview: { cardId: string; emoji: string; pos: { x: number; y: number } } | null
}

const PLAYER_BG = 'linear-gradient(180deg, rgba(182,255,60,0.04) 0%, rgba(182,255,60,0.08) 100%)'
const ENEMY_BG = 'linear-gradient(0deg, rgba(255,70,70,0.04) 0%, rgba(255,70,70,0.08) 100%)'

export default function Battlefield({ state, showDeployZone, onDeployAt, dragPreview }: Props) {
  // Derive positions for static elements.
  const enemyLeftAlive = (state.towers.find((t) => t.id === 'enemy_left')?.hp ?? 0) > 0
  const enemyRightAlive = (state.towers.find((t) => t.id === 'enemy_right')?.hp ?? 0) > 0

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onDeployAt) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = (e.clientX - rect.left) / rect.width
    const yPct = (e.clientY - rect.top) / rect.height
    const x = xPct * ARENA.cols
    const y = (1 - yPct) * ARENA.rows
    onDeployAt({ x, y })
  }

  return (
    <div
      data-battlefield
      onPointerUp={handlePointerUp}
      className="relative w-full mx-auto bg-bg-primary border border-white/15 rounded-card overflow-hidden select-none"
      style={{ aspectRatio: '9 / 16', maxWidth: 'min(420px, 100%)' }}
    >
      {/* Enemy half background */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: '50%', background: ENEMY_BG }}
      />
      {/* Player half background */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ height: '50%', background: PLAYER_BG }}
      />

      {/* River band */}
      <RiverBand />

      {/* Bridges */}
      {ARENA.bridges.map((b) => (
        <Bridge key={b.x} x={b.x} />
      ))}

      {/* Center demarcation labels */}
      <div className="absolute left-3 right-3 top-2 flex justify-between font-mono text-[9px] uppercase tracking-widest text-semantic-error/60">
        <span>OPPONENT</span>
        <span>{state.enemy.elixir.current}/10</span>
      </div>
      <div className="absolute left-3 right-3 bottom-2 flex justify-between font-mono text-[9px] uppercase tracking-widest text-accent-primary/70">
        <span>YOU</span>
        <span>{state.player.elixir.current}/10</span>
      </div>

      {/* Deploy zone overlay during drag */}
      {showDeployZone && (
        <DeployZoneOverlay
          enemyLeftAlive={enemyLeftAlive}
          enemyRightAlive={enemyRightAlive}
        />
      )}

      {/* Towers */}
      {state.towers.map((t) => (
        <Tower key={t.id} tower={t} />
      ))}

      {/* Units */}
      {state.units.map((u) => (
        <Unit key={u.id} unit={u} />
      ))}

      {/* Damage numbers */}
      {state.damageEvents.map((d) => (
        <DamageNumber key={d.id} event={d} />
      ))}

      {/* Drag preview */}
      {dragPreview && <DragPreview {...dragPreview} />}
    </div>
  )
}

function RiverBand() {
  // Use top to push down: river y=15-17 means top from (32-17)/32=46.875% to (32-15)/32=53.125%
  const topPct = (1 - ARENA.river.yMax / ARENA.rows) * 100
  const heightPct = ((ARENA.river.yMax - ARENA.river.yMin + 1) / ARENA.rows) * 100
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        background:
          'linear-gradient(180deg, rgba(60,140,255,0.10), rgba(60,140,255,0.18) 50%, rgba(60,140,255,0.10))',
        borderTop: '1px solid rgba(60,140,255,0.25)',
        borderBottom: '1px solid rgba(60,140,255,0.25)',
      }}
    />
  )
}

function Bridge({ x }: { x: number }) {
  // Bridge is at the river's vertical span, narrow.
  const topPct = (1 - ARENA.river.yMax / ARENA.rows) * 100
  const heightPct = ((ARENA.river.yMax - ARENA.river.yMin + 1) / ARENA.rows) * 100
  const leftPct = (x / ARENA.cols) * 100
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: `${topPct}%`,
        left: `${leftPct}%`,
        height: `${heightPct}%`,
        width: `${(1 / ARENA.cols) * 100}%`,
        transform: 'translateX(-50%)',
        background: 'rgba(180, 130, 80, 0.45)',
        borderLeft: '1px solid rgba(255,255,255,0.15)',
        borderRight: '1px solid rgba(255,255,255,0.15)',
      }}
    />
  )
}

function DeployZoneOverlay({
  enemyLeftAlive,
  enemyRightAlive,
}: {
  enemyLeftAlive: boolean
  enemyRightAlive: boolean
}) {
  // Player deploy zone is y ∈ [0, 14]. After breaking enemy princess,
  // the corresponding past-river half opens up.
  const playerTop = (1 - 14 / ARENA.rows) * 100
  return (
    <>
      <div
        className="absolute left-0 right-0 pointer-events-none animate-pulse"
        style={{
          top: `${playerTop}%`,
          bottom: 0,
          background: 'rgba(182,255,60,0.10)',
          borderTop: '2px dashed rgba(182,255,60,0.5)',
        }}
      />
      {!enemyLeftAlive && (
        <div
          className="absolute pointer-events-none animate-pulse"
          style={{
            top: 0,
            bottom: '50%',
            left: 0,
            width: '50%',
            background: 'rgba(182,255,60,0.08)',
          }}
        />
      )}
      {!enemyRightAlive && (
        <div
          className="absolute pointer-events-none animate-pulse"
          style={{
            top: 0,
            bottom: '50%',
            right: 0,
            width: '50%',
            background: 'rgba(182,255,60,0.08)',
          }}
        />
      )}
    </>
  )
}

function DragPreview({
  emoji,
  pos,
}: {
  cardId: string
  emoji: string
  pos: { x: number; y: number }
}) {
  const left = (pos.x / ARENA.cols) * 100
  const top = (1 - pos.y / ARENA.rows) * 100
  return (
    <div
      className="absolute pointer-events-none transition-none"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="bg-accent-primary/30 border-2 border-accent-primary rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-glow-standard">
        {emoji}
      </div>
    </div>
  )
}

// Tiny memo used by parents to avoid recreating objects on every render.
export function useDragPreview(): null {
  return useMemo(() => null, [])
}
