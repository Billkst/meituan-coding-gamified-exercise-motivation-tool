import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconStar, IconArrowRight } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useCardById } from '@/api/cards'
import type { SubmitWorkoutResult, StreakStatus } from '@/api/submitWorkout'
import type { Rarity } from '@/types/db'

interface LootState {
  result: SubmitWorkoutResult
  ts: number
}

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

const RARITY_BORDER_WIDTH: Record<Rarity, string> = {
  common: 'border',
  rare: 'border-2',
  epic: 'border-2',
  legendary: 'border-2',
}

// Halo strength scales with rarity (common = none).
const RARITY_HALO: Record<Rarity, string> = {
  common: '',
  rare: 'shadow-[0_0_24px_rgba(60,140,255,0.4)]',
  epic: 'shadow-[0_0_32px_rgba(156,60,255,0.5)]',
  legendary: 'shadow-glow-legendary animate-halo-pulse',
}

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

function streakStatusKey(s: StreakStatus): 'workout.streak_new' | 'workout.streak_continued' | 'workout.streak_same_day' | 'workout.streak_protected' | 'workout.streak_broken' {
  if (s === 'new') return 'workout.streak_new'
  if (s === 'continued') return 'workout.streak_continued'
  if (s === 'protected') return 'workout.streak_protected'
  if (s === 'broken') return 'workout.streak_broken'
  return 'workout.streak_same_day'
}

export default function Loot() {
  const { t, lang } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LootState | null
  const [phase, setPhase] = useState<'shuffle' | 'reveal'>('shuffle')

  const { data: card } = useCardById(state?.result.card_drawn.id)

  useEffect(() => {
    if (!state) return
    const timer = setTimeout(() => setPhase('reveal'), 1500)
    return () => clearTimeout(timer)
  }, [state])

  // No recent loot — direct visit to /loot
  if (!state) {
    return (
      <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
          {t('loot.section')}
        </div>
        <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-12">
          {t('loot.title')}
        </h1>
        <div className="bg-bg-secondary border border-white/10 rounded-card p-12 text-center">
          <div className="font-mono text-sm text-text-tertiary mb-6">
            {t('loot.empty')}
          </div>
          <Link
            to="/workout"
            className="inline-flex items-center gap-2 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all duration-150 ease-enter"
          >
            {t('loot.go_workout')}
            <IconArrowRight size={18} />
          </Link>
        </div>
      </div>
    )
  }

  const { result } = state
  const r = result.card_drawn.rarity

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('loot.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-12">
        {phase === 'shuffle' ? t('loot.shuffling_title') : t('loot.reveal_title')}
      </h1>

      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {phase === 'shuffle' && (
          <>
            <div className="relative w-[240px] h-[320px]">
              <div className="absolute inset-0 bg-bg-secondary border border-rarity-common rounded-card animate-shuffle [animation-delay:0ms]" />
              <div className="absolute inset-0 bg-bg-secondary border border-rarity-rare rounded-card animate-shuffle [animation-delay:120ms]" />
              <div className="absolute inset-0 bg-bg-secondary border border-rarity-epic rounded-card animate-shuffle [animation-delay:240ms]" />
            </div>
            <div className="font-mono text-sm uppercase tracking-widest text-text-secondary mt-8">
              {t('loot.shuffling')}
            </div>
          </>
        )}

        {phase === 'reveal' && (
          <>
            <div
              className={
                'relative w-[280px] h-[380px] bg-bg-secondary rounded-card p-6 flex flex-col animate-reveal-flip ' +
                RARITY_BORDER_WIDTH[r] +
                ' ' +
                RARITY_BORDER[r] +
                ' ' +
                RARITY_HALO[r]
              }
            >
              {/* badge / id row */}
              <div className="flex items-start justify-between mb-6">
                {r === 'legendary' ? (
                  <IconStar size={28} className={'fill-current ' + RARITY_TEXT[r]} />
                ) : (
                  <span
                    className={
                      'inline-block px-2 py-0.5 text-[10px] uppercase tracking-widest rounded-full border ' +
                      RARITY_BORDER[r] +
                      ' ' +
                      RARITY_TEXT[r]
                    }
                  >
                    {r}
                  </span>
                )}
                <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">
                  {result.card_drawn.id}
                </span>
              </div>

              {/* name + ability */}
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="font-display font-bold text-3xl text-text-primary mb-3">
                  {card ? (lang === 'zh' ? card.name_zh : card.name_en) : '...'}
                </div>
                <div className="font-body text-sm text-text-secondary leading-relaxed">
                  {card ? (lang === 'zh' ? card.ability_text_zh : card.ability_text_en) : ''}
                </div>
              </div>

              {/* atk / def */}
              <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">
                  ATK / DEF
                </span>
                <span className="font-mono text-sm text-text-primary tabular-nums">
                  {card?.base_attack ?? '—'} / {card?.base_defense ?? '—'}
                </span>
              </div>
            </div>

            {/* XP + streak callout */}
            <div className="mt-8 text-center">
              <div className="font-display text-2xl font-bold text-accent-primary tabular-nums">
                +{result.xp_gained} XP
              </div>
              <div className="font-mono text-xs text-text-tertiary uppercase tracking-widest mt-1">
                {t(streakStatusKey(result.streak_status))} · {t('workout.streak_now', { n: result.streak })}
              </div>
            </div>

            {/* continue */}
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-8 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-12 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all duration-150 ease-enter flex items-center gap-2"
            >
              {t('loot.continue')}
              <IconArrowRight size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
