// Real-time Clash match page — combines engine + battlefield + hand + UI chrome.

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconHome2, IconRefresh, IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { getMuted, playSound, setMuted, subscribeMuted } from '@/clash/audio'
import { useTranslation } from '@/lib/i18n'
import { useClashState } from '@/clash/api/clashState'
import { useFinalizeMatch } from '@/clash/api/clashMatch'
import { useClashEngine, type AiPolicy } from '@/clash/hooks/useClashEngine'
import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import { ARENA, canDeployAt } from '@/clash/lib/arena'
import type { AiDifficulty } from '@/clash/lib/types'
import type { StartMatchInput } from '@/clash/engine/types'
import {
  DEFAULT_TUTORIAL_SCRIPT,
  tutorialDecide,
  tutorialIsComplete,
  tutorialNextDelay,
} from '@/clash/engine/tutorial'
import Hand from '@/clash/components/Hand'
import ElixirBar from '@/clash/components/ElixirBar'
import TimerBar from '@/clash/components/TimerBar'
import SpotlightTour, { type TourStep } from '@/components/SpotlightTour'

// Pixi.js bundle (~400KB) is only needed once the user actually starts a
// match, so split it out of the main chunk.
const PixiBattlefield = lazy(() => import('@/clash/render/PixiBattlefield'))

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
  const location = useLocation()
  const isTutorial =
    new URLSearchParams(location.search).get('tutorial') === '1'
  const { data: clashState, isLoading } = useClashState()
  const finalize = useFinalizeMatch()
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [hasStarted, setHasStarted] = useState(isTutorial)
  const [finalized, setFinalized] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [aiBanner, setAiBanner] = useState<{ cardId: CrCardId; until: number } | null>(null)
  const [endBanner, setEndBanner] = useState<'win' | 'loss' | 'draw' | null>(null)

  // Tutorial uses a fixed deck so the script always finds 'goblin'.
  const TUTORIAL_PLAYER_DECK: CrCardId[] = [
    'knight',
    'archer',
    'goblin',
    'arrows',
    'cannon',
    'giant',
    'musketeer',
    'valkyrie',
  ]

  const startInput = useMemo<StartMatchInput | null>(() => {
    if (!hasStarted) return null

    if (isTutorial) {
      // Hardcoded all-level-1 deck so the tutorial is reproducible regardless
      // of player progression (and runs without needing clashState).
      const playerLevels = Object.fromEntries(
        TUTORIAL_PLAYER_DECK.map((id) => [id, 1]),
      ) as Record<CrCardId, number>
      const enemyLevels = playerLevels
      return {
        player: { cardIds: TUTORIAL_PLAYER_DECK, levels: playerLevels },
        enemy: { cardIds: TUTORIAL_PLAYER_DECK, levels: enemyLevels },
        difficulty: 'easy',
        seed: 1, // deterministic so the tutorial story is the same every run
      }
    }

    if (!clashState) return null
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
  }, [clashState, hasStarted, difficulty, isTutorial])

  // Tutorial swaps the adversarial AI policy for a one-shot goblin spawner.
  const aiPolicy = useMemo<AiPolicy | undefined>(() => {
    if (!isTutorial) return undefined
    return {
      decide: (s) => tutorialDecide(s, DEFAULT_TUTORIAL_SCRIPT),
      nextDelay: (s) => tutorialNextDelay(s),
    }
  }, [isTutorial])

  const engine = useClashEngine(startInput, aiPolicy)

  // Tutorial completion: enemy_left princess HP hit 0 → bounce to TutorialResult.
  useEffect(() => {
    if (!isTutorial) return
    if (!engine.state) return
    if (!tutorialIsComplete(engine.state, DEFAULT_TUTORIAL_SCRIPT)) return
    const id = window.setTimeout(() => navigate('/clash/tutorial-result'), 900)
    return () => window.clearTimeout(id)
  }, [isTutorial, engine.state, navigate])

  // Tutorial inactivity hint ladder: 30s / 60s / 90s after match start.
  const [hintLevel, setHintLevel] = useState(0)
  const tutorialStartRef = useRef<number | null>(null)
  const lastPlayerDeployRef = useRef<number>(Date.now())
  useEffect(() => {
    if (!isTutorial || !hasStarted) return
    tutorialStartRef.current = Date.now()
    setHintLevel(0)
    const id = window.setInterval(() => {
      const idle = (Date.now() - lastPlayerDeployRef.current) / 1000
      if (idle > 90) setHintLevel(3)
      else if (idle > 60) setHintLevel(2)
      else if (idle > 30) setHintLevel(1)
      else setHintLevel(0)
    }, 1000)
    return () => window.clearInterval(id)
  }, [isTutorial, hasStarted])

  // Union of cards that can appear in the match — pre-warm atlases.
  const matchCardIds = useMemo<readonly CrCardId[]>(() => {
    if (!startInput) return []
    return Array.from(
      new Set([...startInput.player.cardIds, ...startInput.enemy.cardIds]),
    )
  }, [startInput])

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

  // Sync mute state to a piece of local state so the toggle button can re-render.
  const [muted, setMutedLocal] = useState<boolean>(() => getMuted())
  useEffect(() => subscribeMuted(setMutedLocal), [])
  const toggleMute = () => setMuted(!muted)

  // Auto-finalize when match ends — show big banner for ~1.8s, then RPC + navigate.
  // The timer is tracked via ref so subsequent renders (which re-run the effect due
  // to `state` ref dep) don't cancel it via the cleanup return.
  const finalizeTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (isTutorial) return // tutorial uses its own completion path, no RPC
    if (!state || phase !== 'ended' || finalized || !state.result) return
    if (finalizeTimerRef.current !== null) return
    setFinalized(true)
    setEndBanner(state.result)
    playSound(state.result === 'win' ? 'victory' : state.result === 'loss' ? 'defeat' : 'unit_deploy')
    const startTs = startTimeRef.current ?? Date.now()
    const duration = Math.round((Date.now() - startTs) / 1000)
    const matchResult = state.result
    const playerTowersLost = state.player.towersLost
    const aiTowersLost = state.enemy.towersLost
    const tickCount = state.tick

    finalizeTimerRef.current = window.setTimeout(() => {
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
  }, [state, phase, finalized, finalize, navigate, difficulty, isTutorial])

  useEffect(() => {
    return () => {
      if (finalizeTimerRef.current !== null) {
        window.clearTimeout(finalizeTimerRef.current)
        finalizeTimerRef.current = null
      }
    }
  }, [])

  if (!isTutorial && (isLoading || !clashState)) {
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
        const ok = engine.deploy(handIndex, { x, y })
        if (ok) lastPlayerDeployRef.current = Date.now()
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
          {isTutorial && (
            <button
              onClick={() => {
                window.localStorage.setItem('pulse.onboarding.completed_v2', '1')
                navigate('/clash', { replace: true })
              }}
              className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary hover:text-text-primary px-2 py-1 rounded-button border border-white/10"
            >
              {t('onboarding.v2.tutorial.skip' as never)}
            </button>
          )}
          <button
            onClick={toggleMute}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-button border border-white/10"
            aria-label={muted ? t('clash.match.unmute' as never) : t('clash.match.mute' as never)}
          >
            {muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
          </button>
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
        <Suspense
          fallback={
            <div
              data-battlefield
              className="relative w-full mx-auto bg-bg-primary border border-white/15 rounded-card overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: '9 / 16', maxWidth: 'min(420px, 100%)' }}
            >
              <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary animate-pulse">
                {t('clash.match.loading_battlefield' as never)}
              </div>
            </div>
          }
        >
          <PixiBattlefield
            state={state}
            showDeployZone={dragHandIndex !== null}
            dragPreview={dragPreview}
            cardIds={matchCardIds}
          />
        </Suspense>
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

      {/* Tutorial inactivity hint ladder */}
      {isTutorial && hintLevel > 0 && (
        <div
          key={hintLevel}
          className="fixed bottom-44 left-1/2 -translate-x-1/2 z-30 max-w-xs"
        >
          <div className="bg-bg-secondary border border-accent-primary/40 rounded-card px-4 py-2.5 shadow-glow-standard animate-pulse text-center">
            <div className="font-display font-bold text-sm text-accent-primary mb-0.5">
              {hintLevel === 1 && t('onboarding.v2.tutorial.hint_1' as never)}
              {hintLevel === 2 && t('onboarding.v2.tutorial.hint_2' as never)}
              {hintLevel === 3 && t('onboarding.v2.tutorial.hint_3' as never)}
            </div>
            {hintLevel === 3 && (
              <button
                onClick={() => {
                  window.localStorage.setItem('pulse.onboarding.completed_v2', '1')
                  navigate('/clash', { replace: true })
                }}
                className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-secondary hover:text-text-primary underline"
              >
                {t('onboarding.v2.tutorial.skip' as never)}
              </button>
            )}
          </div>
        </div>
      )}

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
