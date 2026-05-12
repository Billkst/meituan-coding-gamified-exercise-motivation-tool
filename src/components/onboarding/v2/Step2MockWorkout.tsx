// Day 25 — Onboarding v2 / Step 2: Mock workout.
//
// 30-second simulated jog so the judge experiences the workout-to-gold
// loop without actually running a real workout. Pure local state — no
// submitWorkout RPC, no Supabase write. On completion, ~14 gold coins
// fly across the screen and a "+200 gold" badge bounces.

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface Props {
  onContinue: () => void
}

const TOTAL_SECONDS = 30
const COIN_COUNT = 14
const GOLD_BONUS = 200

export default function Step2MockWorkout({ onContinue }: Props) {
  const { t } = useTranslation()
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS)
  const [phase, setPhase] = useState<'running' | 'reward' | 'idle-skip'>('running')

  useEffect(() => {
    if (phase !== 'running') return
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [phase])

  useEffect(() => {
    if (secondsLeft === 0 && phase === 'running') {
      setPhase('reward')
    }
  }, [secondsLeft, phase])

  const progressPct = ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex items-center justify-center px-6 overflow-hidden">
      <div className="max-w-md w-full text-center">
        <div className="font-mono text-[11px] uppercase tracking-widest text-accent-primary mb-4">
          {t('onboarding.v2.step2.tag' as never)}
        </div>
        <h1 className="font-display font-black text-3xl uppercase tracking-tight text-text-primary mb-2">
          {phase === 'running'
            ? t('onboarding.v2.step2.running' as never)
            : t('onboarding.v2.step2.complete' as never)}
        </h1>
        <p className="text-text-secondary text-sm mb-10">
          {phase === 'running'
            ? t('onboarding.v2.step2.sub_running' as never)
            : t('onboarding.v2.step2.sub_complete' as never)}
        </p>

        <div className="font-display font-bold text-7xl text-accent-primary mb-6 tabular-nums">
          {secondsLeft}s
        </div>

        <div className="bg-bg-tertiary rounded-full h-3 overflow-hidden border border-white/10 mb-12">
          <div
            className="h-full bg-accent-primary transition-all duration-1000 ease-linear shadow-glow-standard"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {phase === 'reward' && (
          <>
            <CoinShower count={COIN_COUNT} />
            <div className="font-display font-black text-5xl text-rarity-legendary mb-4 animate-bounce">
              +{GOLD_BONUS} 💰
            </div>
            <button
              onClick={onContinue}
              className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:scale-[1.02] transition-transform"
            >
              {t('onboarding.v2.step2.cta_continue' as never)}
            </button>
          </>
        )}

        {phase === 'running' && (
          <button
            onClick={onContinue}
            className="text-text-tertiary hover:text-text-secondary font-mono text-[10px] uppercase tracking-widest"
          >
            {t('onboarding.v2.step2.cta_skip' as never)}
          </button>
        )}

        <div className="mt-12 font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('onboarding.v2.step_indicator' as never, { n: 2, total: 4 })}
        </div>
      </div>
    </div>
  )
}

function CoinShower({ count }: { count: number }) {
  // Coins fly across the screen left → right with random vertical offsets.
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {Array.from({ length: count }).map((_, i) => {
        const top = 10 + Math.random() * 70
        const delay = i * 80
        const dur = 900 + Math.random() * 400
        return (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              top: `${top}%`,
              left: '-32px',
              animation: `pulse-coin-fly ${dur}ms ease-in ${delay}ms forwards`,
            }}
          >
            💰
          </div>
        )
      })}
      <style>
        {`@keyframes pulse-coin-fly {
          0% { transform: translate(0, 0) rotate(0); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(110vw, -40vh) rotate(360deg); opacity: 0; }
        }`}
      </style>
    </div>
  )
}
