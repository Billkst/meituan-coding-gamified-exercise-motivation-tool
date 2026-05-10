import { useState } from 'react'
import { IconX, IconArrowDown, IconArrowUp, IconHandFinger } from '@tabler/icons-react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'

interface Props {
  open: boolean
  onClose: () => void
}

interface Step {
  titleKey: TranslationKey
  bodyKey: TranslationKey
  icon: typeof IconArrowDown
  iconColor: string
}

const STEPS: Step[] = [
  {
    titleKey: 'battle.tutorial.s1.title',
    bodyKey: 'battle.tutorial.s1.body',
    icon: IconArrowUp,
    iconColor: 'text-semantic-error',
  },
  {
    titleKey: 'battle.tutorial.s2.title',
    bodyKey: 'battle.tutorial.s2.body',
    icon: IconArrowDown,
    iconColor: 'text-accent-primary',
  },
  {
    titleKey: 'battle.tutorial.s3.title',
    bodyKey: 'battle.tutorial.s3.body',
    icon: IconHandFinger,
    iconColor: 'text-rarity-legendary',
  },
]

export default function BattleTutorialOverlay({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  if (!open) return null

  const current = STEPS[step]
  const Ico = current.icon
  const isLast = step === STEPS.length - 1

  const next = () => {
    if (isLast) {
      onClose()
      setStep(0)
    } else {
      setStep(step + 1)
    }
  }
  const prev = () => setStep(Math.max(0, step - 1))

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-8">
      <div className="relative bg-bg-secondary border border-white/10 rounded-card w-full max-w-md p-6 md:p-8 shadow-glow-standard">
        <button
          type="button"
          onClick={() => { onClose(); setStep(0) }}
          aria-label={t('battle.tutorial.skip')}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary p-1"
        >
          <IconX size={18} />
        </button>

        <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-2 tabular-nums">
          {t('battle.tutorial.progress', { n: step + 1, total: STEPS.length })}
        </div>

        <div className={'mb-4 ' + current.iconColor}>
          <Ico size={32} strokeWidth={2.5} />
        </div>

        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-3">
          {t(current.titleKey)}
        </h2>

        <p className="font-body text-sm text-text-secondary leading-relaxed mb-6">
          {t(current.bodyKey)}
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
            onClick={() => { onClose(); setStep(0) }}
            className="font-mono text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary"
          >
            {t('battle.tutorial.skip')}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="font-mono text-xs uppercase tracking-widest border border-white/10 hover:border-accent-primary py-2 px-4 rounded-button"
              >
                {t('battle.tutorial.prev')}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="font-mono text-xs uppercase tracking-widest bg-accent-primary text-bg-primary py-2 px-5 rounded-button shadow-glow-subtle hover:shadow-glow-standard"
            >
              {isLast ? t('battle.tutorial.done') : t('battle.tutorial.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
