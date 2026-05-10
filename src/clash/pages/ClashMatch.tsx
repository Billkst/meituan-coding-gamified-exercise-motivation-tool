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
import SpotlightTour, { type TourStep } from '@/components/SpotlightTour'

const CLASH_TOUR_KEY = 'pulse.clash.tour_seen'
const CLASH_TOUR_STEPS: TourStep[] = [
  { titleKey: 'clash.tour.welcome.title', bodyKey: 'clash.tour.welcome.body' },
  { target: 'clash.timer', titleKey: 'clash.tour.timer.title', bodyKey: 'clash.tour.timer.body' },
  { target: 'clash.elixir', titleKey: 'clash.tour.elixir.title', bodyKey: 'clash.tour.elixir.body' },
  { target: 'clash.hand', titleKey: 'clash.tour.hand.title', bodyKey: 'clash.tour.hand.body' },
]

export default function ClashMatch() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { data: clashState, isLoading } = useClashState()
  const finalize = useFinalizeMatch()
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [hasStarted, setHasStarted] = useState(false)
  const [finalized, setFinalized] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [aiBanner, setAiBanner] = useState<{ cardId: CrCardId; until: number } | null>(null)
  const [endBanner, setEndBanner] = useState<'win' | 'loss' | 'draw' | null>(null)

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

  // First-time spotlight tour: show on first match start; pause engine while open.
  useEffect(() => {
    if (!hasStarted) return
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(CLASH_TOUR_KEY)
    if (!seen) setShowTour(true)
  }, [hasStarted])

  useEffect(() => {
    if (!engine) return
    if (showTour) engine.pause()
    else engine.resume()
  }, [showTour, engine])

  const dismissTour = () => {
    window.localStorage.setItem(CLASH_TOUR_KEY, '1')
    setShowTour(false)
  }

  // AI deploy hint: scan log tail for newest enemy deploy → show 1.5s banner.
  const lastSeenEnemyDeployTickRef = useRef(-1)
  useEffect(() => {
    if (!state) return
    for (let i = state.log.length - 1; i >= 0; i--) {
      const entry = state.log[i]
      if (entry.t !== 'deploy') {
        if (entry.t === 'spell') break
        continue
      }
      if (entry.side === 'enemy' && entry.tick > lastSeenEnemyDeployTickRef.current) {
        lastSeenEnemyDeployTickRef.current = entry.tick
        const cid = entry.cardId
        queueMicrotask(() => setAiBanner({ cardId: cid, until: Date.now() + 1500 }))
      }
      break
    }
  })

  useEffect(() => {
    if (!aiBanner) return
    const remaining = aiBanner.until - Date.now()
    if (remaining <= 0) {
      setAiBanner(null)
      return
    }
    const id = window.setTimeout(() => setAiBanner(null), remaining)
    return () => window.clearTimeout(id)
  }, [aiBanner])

  // Auto-finalize when match ends — show big banner for ~1.8s, then RPC + navigate.
  useEffect(() => {
    if (!state || phase !== 'ended' || finalized || !state.result) return
    setFinalized(true)
    setEndBanner(state.result)
    const startTs = startTimeRef.current ?? Date.now()
    const duration = Math.round((Date.now() - startTs) / 1000)
    const matchResult = state.result
    const playerTowersLost = state.player.towersLost
    const aiTowersLost = state.enemy.towersLost
    const tickCount = state.tick

    const delay = window.setTimeout(() => {
      finalize.mutate(
        {
          result: matchResult,
          duration,
          player_towers_lost: playerTowersLost,
          ai_towers_lost: aiTowersLost,
          difficulty,
          replay: { tickCount },
        },
        {
          onSuccess: (r) => {
            navigate('/clash/result', {
              state: {
                result: matchResult,
                gold_earned: r.gold_earned,
                chest_id: r.chest_id,
                chest_type: r.chest_type,
                win_streak: r.win_streak,
                player_towers_lost: playerTowersLost,
                ai_towers_lost: aiTowersLost,
                duration,
              },
            })
          },
          onError: () => {
            navigate('/clash/result', {
              state: {
                result: matchResult,
                gold_earned: 0,
                chest_id: null,
                chest_type: null,
                win_streak: 0,
                player_towers_lost: playerTowersLost,
                ai_towers_lost: aiTowersLost,
                duration,
                degraded: true,
              },
            })
          },
        },
      )
    }, 1800)

    return () => window.clearTimeout(delay)
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

      {/* AI deploy hint banner */}
      {aiBanner && (
        <div
          key={aiBanner.until}
          className="fixed top-14 left-1/2 -translate-x-1/2 bg-semantic-error/90 text-white font-display font-bold uppercase tracking-wider text-xs px-4 py-1.5 rounded-button shadow-glow-standard pointer-events-none z-40 animate-pulse"
        >
          {(() => {
            const card = CR_CARDS_BY_ID[aiBanner.cardId]
            const name = card ? (lang === 'zh' ? card.name_zh : card.name_en) : aiBanner.cardId
            return t('clash.match.ai_deploys' as never, { card: `${card?.emoji ?? ''} ${name}` })
          })()}
        </div>
      )}

      {/* Match end banner — shown for ~1.8s before navigating to result */}
      {endBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <div className="text-8xl mb-4">
              {endBanner === 'win' ? '👑' : endBanner === 'loss' ? '💀' : '🤝'}
            </div>
            <div
              className={
                'font-display font-black uppercase tracking-tight text-6xl ' +
                (endBanner === 'win'
                  ? 'text-accent-primary animate-halo-pulse'
                  : endBanner === 'loss'
                  ? 'text-semantic-error'
                  : 'text-text-secondary')
              }
              style={{
                textShadow:
                  endBanner === 'win'
                    ? '0 0 32px rgba(182,255,60,0.7), 0 0 64px rgba(182,255,60,0.3)'
                    : endBanner === 'loss'
                    ? '0 0 24px rgba(255,70,70,0.7)'
                    : 'none',
              }}
            >
              {t(
                endBanner === 'win'
                  ? 'clash.match.banner_win'
                  : endBanner === 'loss'
                  ? 'clash.match.banner_loss'
                  : 'clash.match.banner_draw',
              )}
            </div>
          </div>
        </div>
      )}

      {/* First-time spotlight tour */}
      <SpotlightTour steps={CLASH_TOUR_STEPS} open={showTour} onClose={dismissTour} />
    </div>
  )
}
