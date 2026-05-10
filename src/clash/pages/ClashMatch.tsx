// Real-time Clash match page — combines engine + battlefield + hand + UI chrome.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHome2, IconRefresh } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClashState } from '@/clash/api/clashState'
import { useFinalizeMatch } from '@/clash/api/clashMatch'
import { useClashEngine } from '@/clash/hooks/useClashEngine'
import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import { ARENA, canDeployAt } from '@/clash/lib/arena'
import type { AiDifficulty } from '@/clash/lib/types'
import type { StartMatchInput } from '@/clash/engine/types'
import Battlefield from '@/clash/components/Battlefield'
import Hand from '@/clash/components/Hand'
import ElixirBar from '@/clash/components/ElixirBar'
import TimerBar from '@/clash/components/TimerBar'

export default function ClashMatch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: clashState, isLoading } = useClashState()
  const finalize = useFinalizeMatch()
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [hasStarted, setHasStarted] = useState(false)
  const [finalized, setFinalized] = useState(false)

  const startInput = useMemo<StartMatchInput | null>(() => {
    if (!clashState || !hasStarted) return null
    if (clashState.deck.length !== 8) return null
    const playerLevels = Object.fromEntries(
      clashState.cards.map((c) => [c.id, c.level]),
    ) as Record<CrCardId, number>
    // Enemy uses same deck shape with level 1 (could level-match later)
    const enemyDeck: CrCardId[] = ['knight', 'archer', 'goblin', 'giant', 'musketeer', 'valkyrie', 'arrows', 'cannon']
    const enemyLevels = Object.fromEntries(enemyDeck.map((id) => [id, 1])) as Record<CrCardId, number>
    return {
      player: { cardIds: clashState.deck, levels: playerLevels },
      enemy: { cardIds: enemyDeck, levels: enemyLevels },
      difficulty,
      seed: Date.now() & 0x7fffffff,
    }
  }, [clashState, hasStarted, difficulty])

  const engine = useClashEngine(startInput)

  // Drag state
  const [dragHandIndex, setDragHandIndex] = useState<number | null>(null)
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number | null>(null)

  const state = engine.state
  const phase = state?.phase ?? 'pregame'

  // Track start time for duration logging
  useEffect(() => {
    if (hasStarted && startTimeRef.current === null) {
      startTimeRef.current = Date.now()
    }
  }, [hasStarted])

  // Auto-finalize when match ends
  useEffect(() => {
    if (!state || phase !== 'ended' || finalized || !state.result) return
    setFinalized(true)
    const startTs = startTimeRef.current ?? Date.now()
    const duration = Math.round((Date.now() - startTs) / 1000)
    finalize.mutate(
      {
        result: state.result,
        duration,
        player_towers_lost: state.player.towersLost,
        ai_towers_lost: state.enemy.towersLost,
        difficulty,
        replay: { tickCount: state.tick },
      },
      {
        onSuccess: (r) => {
          navigate('/clash/result', {
            state: {
              result: state.result,
              gold_earned: r.gold_earned,
              chest_id: r.chest_id,
              chest_type: r.chest_type,
              win_streak: r.win_streak,
              player_towers_lost: state.player.towersLost,
              ai_towers_lost: state.enemy.towersLost,
              duration,
            },
          })
        },
        onError: () => {
          // Navigate even if RPC failed — show local result
          navigate('/clash/result', {
            state: {
              result: state.result,
              gold_earned: 0,
              chest_id: null,
              chest_type: null,
              win_streak: 0,
              player_towers_lost: state.player.towersLost,
              ai_towers_lost: state.enemy.towersLost,
              duration,
              degraded: true,
            },
          })
        },
      },
    )
  }, [state, phase, finalized, finalize, navigate, difficulty])

  if (isLoading || !clashState) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest text-text-secondary animate-pulse">
        loading clash…
      </div>
    )
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-bg-secondary border border-white/10 rounded-card p-8 max-w-md w-full">
          <div className="font-mono text-[11px] uppercase tracking-widest text-accent-primary mb-2">
            {t('clash.brand' as never)}
          </div>
          <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-6">
            {t('clash.home.battle_cta' as never)}
          </h1>
          <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mb-2">
            {t('clash.match.difficulty.normal' as never)} · 选择难度
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={
                  'font-mono uppercase text-xs py-2 px-2 rounded-button border transition-colors ' +
                  (difficulty === d
                    ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                    : 'border-white/15 text-text-secondary hover:border-white/30')
                }
              >
                {t(`clash.match.difficulty.${d}` as never)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setHasStarted(true)}
            className="w-full bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
          >
            {t('clash.home.battle_cta' as never)}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full mt-3 font-mono text-[10px] uppercase tracking-widest text-text-tertiary hover:text-text-primary"
          >
            {t('clash.result.home' as never)}
          </button>
        </div>
      </div>
    )
  }

  if (!state) {
    return null
  }

  const enemyLeftAlive = (state.towers.find((t) => t.id === 'enemy_left')?.hp ?? 0) > 0
  const enemyRightAlive = (state.towers.find((t) => t.id === 'enemy_right')?.hp ?? 0) > 0

  const handleDragStart = (handIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    setDragHandIndex(handIndex)
    setDragPreviewPos(null)

    const onMove = (ev: PointerEvent) => {
      const arena = containerRef.current?.querySelector<HTMLDivElement>('[data-battlefield]')
      if (!arena) return
      const rect = arena.getBoundingClientRect()
      const xPct = (ev.clientX - rect.left) / rect.width
      const yPct = (ev.clientY - rect.top) / rect.height
      if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) {
        setDragPreviewPos(null)
        return
      }
      const x = xPct * ARENA.cols
      const y = (1 - yPct) * ARENA.rows
      setDragPreviewPos({ x, y })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const arena = containerRef.current?.querySelector<HTMLDivElement>('[data-battlefield]')
      const rect = arena?.getBoundingClientRect()
      setDragHandIndex(null)
      setDragPreviewPos(null)
      if (!rect) return
      const xPct = (ev.clientX - rect.left) / rect.width
      const yPct = (ev.clientY - rect.top) / rect.height
      if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return
      const x = xPct * ARENA.cols
      const y = (1 - yPct) * ARENA.rows
      if (canDeployAt('player', x, y, enemyLeftAlive, enemyRightAlive)) {
        engine.deploy(handIndex, { x, y })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    void e
  }

  const draggingCard = dragHandIndex !== null ? state.player.hand.pile[dragHandIndex] : null
  const dragPreview =
    dragHandIndex !== null && dragPreviewPos && draggingCard
      ? {
          cardId: draggingCard,
          emoji: CR_CARDS_BY_ID[draggingCard]?.emoji ?? '?',
          pos: dragPreviewPos,
        }
      : null

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      {/* Top bar: timer + tower indicators */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/10">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-text-tertiary hover:text-text-primary p-1.5 rounded-button border border-white/10"
          aria-label="Home"
        >
          <IconHome2 size={16} />
        </button>
        <TimerBar elapsed={state.elapsed} phase={state.phase} />
        <div className="flex items-center gap-1">
          <button
            onClick={() => engine.restart()}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-button border border-white/10"
            aria-label="Restart"
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </div>

      {/* Battlefield */}
      <div className="flex-1 flex items-center justify-center p-3">
        <Battlefield
          state={state}
          showDeployZone={dragHandIndex !== null}
          dragPreview={dragPreview}
        />
      </div>

      {/* Elixir bar */}
      <ElixirBar elixir={state.player.elixir} phase={state.phase} />

      {/* Hand */}
      <Hand
        pile={state.player.hand.pile}
        elixir={state.player.elixir.current}
        draggingHandIndex={dragHandIndex}
        onDragStart={handleDragStart}
      />
    </div>
  )
}
