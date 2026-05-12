// Day 25 — Onboarding v2 / Step 1: Welcome.
//
// One-screen pitch of the product loop in plain language. No graph, no
// 5-bullet feature list — judges are evaluating product clarity, so the
// hierarchy is: brand → one-sentence value prop → one-sentence mechanic
// description → CTA.

import { useTranslation } from '@/lib/i18n'

interface Props {
  onContinue: () => void
}

export default function Step1Welcome({ onContinue }: Props) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="font-mono text-[11px] uppercase tracking-widest text-accent-primary mb-4">
          {t('onboarding.v2.brand' as never)}
        </div>
        <h1 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight text-text-primary mb-6 leading-tight">
          {t('onboarding.v2.step1.hero' as never)}
        </h1>
        <p className="text-text-secondary text-base md:text-lg mb-12 leading-relaxed">
          {t('onboarding.v2.step1.sub' as never)}
        </p>
        <button
          onClick={onContinue}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
        >
          {t('onboarding.v2.step1.cta' as never)}
        </button>
        <div className="mt-12 font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('onboarding.v2.step_indicator' as never, { n: 1, total: 4 })}
        </div>
      </div>
    </div>
  )
}
