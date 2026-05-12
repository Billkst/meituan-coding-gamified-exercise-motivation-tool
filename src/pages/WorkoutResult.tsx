import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'
import type { SubmitWorkoutResult } from '@/api/submitWorkout'
import type { Rarity } from '@/types/db'

type Phase = 'closed' | 'opening' | 'revealed'

const RARITY_EMOJI: Record<Rarity, string> = {
  common: '🃏',
  rare: '💎',
  epic: '⚡',
  legendary: '👑',
}

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic shadow-[0_0_24px_rgba(180,80,255,0.6)]',
  legendary: 'border-rarity-legendary shadow-[0_0_32px_rgba(255,200,60,0.7)]',
}

export default function WorkoutResult() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { result?: SubmitWorkoutResult } | null
  const [phase, setPhase] = useState<Phase>('closed')

  useEffect(() => {
    if (phase !== 'opening') return
    const id = window.setTimeout(() => setPhase('revealed'), 700)
    return () => window.clearTimeout(id)
  }, [phase])

  if (!state?.result) {
    return <Navigate to="/workout" replace />
  }
  const { card_drawn, xp_gained, gold_earned, streak, streak_status } = state.result

  const streakLine =
    streak_status === 'continued'
      ? t('workout.result.streak.continued' as never, { n: streak })
      : streak_status === 'new'
        ? t('workout.result.streak.new' as never)
        : streak_status === 'same_day'
          ? t('workout.result.streak.same_day' as never, { n: streak })
          : streak_status === 'protected'
            ? t('workout.result.streak.protected' as never)
            : t('workout.result.streak.broken' as never)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-bg-primary">
      <div className="font-mono text-[11px] uppercase tracking-widest text-accent-primary mb-2">
        +{xp_gained} XP · +{gold_earned} 💰
      </div>
      <h1 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight mb-2 text-text-primary">
        {t('workout.result.title' as never)}
      </h1>
      <p className="text-text-secondary text-sm mb-10">{streakLine}</p>

      {phase === 'closed' && (
        <button
          onClick={() => setPhase('opening')}
          className="relative group focus:outline-none"
          aria-label={t('workout.result.tap_to_open' as never)}
        >
          <div className="absolute inset-0 rounded-full bg-rarity-legendary/30 blur-2xl animate-pulse" />
          <div className="relative text-8xl select-none group-hover:scale-110 transition-transform">📦</div>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
            {t('workout.result.tap_to_open' as never)}
          </div>
        </button>
      )}

      {phase === 'opening' && (
        <div className="text-8xl select-none animate-spin-slow">✨📦✨</div>
      )}

      {phase === 'revealed' && (
        <div
          className={
            'w-48 aspect-[3/4] rounded-card border-2 bg-bg-secondary flex flex-col items-center justify-center gap-3 px-3 ' +
            RARITY_BORDER[card_drawn.rarity]
          }
        >
          <div className="text-6xl">{RARITY_EMOJI[card_drawn.rarity]}</div>
          <div className="font-display font-bold text-sm uppercase tracking-wider text-text-primary text-center break-all">
            {card_drawn.id}
          </div>
          <div
            className={
              'font-mono text-[10px] uppercase tracking-widest ' +
              (card_drawn.rarity === 'legendary'
                ? 'text-rarity-legendary'
                : card_drawn.rarity === 'epic'
                  ? 'text-rarity-epic'
                  : card_drawn.rarity === 'rare'
                    ? 'text-rarity-rare'
                    : 'text-rarity-common')
            }
          >
            {card_drawn.rarity}
          </div>
        </div>
      )}

      {phase === 'revealed' && (
        <div className="flex gap-3 mt-10">
          <button
            onClick={() => navigate('/clash')}
            className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-6 rounded-button shadow-glow-standard hover:scale-[1.02] transition-transform"
          >
            {t('workout.result.cta.battle' as never)}
          </button>
          <button
            onClick={() => navigate('/workout')}
            className="border border-white/20 text-text-secondary font-display font-bold uppercase tracking-wider py-3 px-6 rounded-button hover:border-accent-primary hover:text-accent-primary transition-colors"
          >
            {t('workout.result.cta.again' as never)}
          </button>
        </div>
      )}
    </div>
  )
}
