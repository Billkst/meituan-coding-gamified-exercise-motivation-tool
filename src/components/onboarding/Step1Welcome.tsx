import { useTranslation } from '@/lib/i18n'

export default function Step1Welcome({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div
        className="font-display font-black text-accent-primary leading-none mb-6"
        style={{
          fontSize: 'clamp(80px, 16vh, 200px)',
          textShadow: '0 0 24px rgba(182,255,60,0.7), 0 0 48px rgba(182,255,60,0.3)',
        }}
      >
        PULSE
      </div>
      <div className="font-mono text-base uppercase tracking-[0.2em] text-text-secondary mb-3">
        {t('onboarding.step1.title' as never)}
      </div>
      <div className="font-mono text-sm text-text-tertiary text-center max-w-md">
        {t('onboarding.step1.subtitle' as never)}
      </div>
      <button
        onClick={onNext}
        className="mt-12 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-12 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
      >
        {t('onboarding.step1.cta' as never)}
      </button>
    </div>
  )
}
