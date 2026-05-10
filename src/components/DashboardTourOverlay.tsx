import { useState } from 'react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { IconX } from '@tabler/icons-react'

interface Props {
  onDone: () => void
}

const STEPS: { title: TranslationKey; body: TranslationKey }[] = [
  { title: 'tour.step1.title', body: 'tour.step1.body' },
  { title: 'tour.step2.title', body: 'tour.step2.body' },
  { title: 'tour.step3.title', body: 'tour.step3.body' },
  { title: 'tour.step4.title', body: 'tour.step4.body' },
  { title: 'tour.step5.title', body: 'tour.step5.body' },
  { title: 'tour.step6.title', body: 'tour.step6.body' },
]

export default function DashboardTourOverlay({ onDone }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const total = STEPS.length
  const isLast = step === total - 1
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-8">
      <div className="relative bg-bg-secondary border border-white/10 rounded-card w-full max-w-md p-6 md:p-8 shadow-glow-standard">
        <button
          type="button"
          onClick={onDone}
          aria-label={t('tour.skip')}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary p-1"
        >
          <IconX size={18} />
        </button>

        <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-2 tabular-nums">
          {t('tour.progress', { n: step + 1, total })}
        </div>

        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">
          {t(current.title)}
        </h2>

        <p className="font-body text-sm text-text-secondary leading-relaxed mb-6">
          {t(current.body)}
        </p>

        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                'h-1.5 flex-1 rounded-full transition-colors ' +
                (i === step ? 'bg-accent-primary' : i < step ? 'bg-accent-primary/40' : 'bg-white/10')
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDone}
            className="font-mono text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary"
          >
            {t('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="font-mono text-xs uppercase tracking-widest border border-white/10 hover:border-accent-primary py-2 px-4 rounded-button"
              >
                {t('tour.prev')}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onDone() : setStep(step + 1))}
              className="font-mono text-xs uppercase tracking-widest bg-accent-primary text-bg-primary py-2 px-5 rounded-button shadow-glow-subtle hover:shadow-glow-standard"
            >
              {isLast ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
