// Day 25 — TutorialResult.
//
// Shown after the player drops the enemy_left princess during the tutorial.
// Deliberately separate from ClashResult so the "first match" doesn't write
// to cr_match_log, doesn't show gold/chest reward UI, and the copy stays
// tutorial-flavored. Sets onboarding-v2 completion flag and hands the user
// off to ClashHome.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'

export default function TutorialResult() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    window.localStorage.setItem('pulse.onboarding.completed_v2', '1')
  }, [])

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col items-center justify-center px-6">
      <div className="text-8xl mb-6 animate-bounce">🏆</div>
      <h1 className="font-display font-black text-4xl uppercase tracking-tight text-accent-primary mb-3 text-center" style={{ textShadow: '0 0 32px rgba(182,255,60,0.7)' }}>
        {t('onboarding.v2.tutorial.title' as never)}
      </h1>
      <p className="text-text-secondary text-base mb-12 max-w-md text-center">
        {t('onboarding.v2.tutorial.sub' as never)}
      </p>
      <button
        onClick={() => navigate('/clash', { replace: true })}
        className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-10 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
      >
        {t('onboarding.v2.tutorial.cta' as never)}
      </button>
    </div>
  )
}
