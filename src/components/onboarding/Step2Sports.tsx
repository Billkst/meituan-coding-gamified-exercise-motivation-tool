import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSports } from '@/api/sports'

interface Props {
  onNext: (selected: string[]) => void
  onPrev: () => void
}

export default function Step2Sports({ onNext, onPrev }: Props) {
  const { t, lang } = useTranslation()
  const { data: sports = [] } = useSports()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  const canContinue = selected.size >= 1 && selected.size <= 3

  return (
    <div className="flex-1 flex flex-col items-center px-8 overflow-y-auto pb-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2 text-center mt-4">
        {t('onboarding.step2.title' as never)}
      </h2>
      <div className="font-mono text-xs text-text-tertiary uppercase tracking-widest mb-6">
        {t('onboarding.step2.selected' as never, { n: selected.size } as never)}
      </div>
      <div className="grid grid-cols-5 gap-3 max-w-3xl w-full mb-8">
        {sports.map((sp) => {
          const on = selected.has(sp.id)
          return (
            <button
              key={sp.id}
              onClick={() => toggle(sp.id)}
              className={
                'flex flex-col items-center justify-center p-3 rounded-card border transition-all aspect-square ' +
                (on
                  ? 'border-accent-primary bg-accent-primary/10 shadow-glow-standard'
                  : 'border-white/10 bg-bg-secondary hover:border-white/30')
              }
            >
              <div className="text-2xl mb-1">{sp.icon}</div>
              <div className="font-mono text-[10px] uppercase tracking-tight text-center">
                {lang === 'zh' ? sp.name_zh : sp.name_en}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex gap-4">
        <button
          onClick={onPrev}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.prev' as never)}
        </button>
        <button
          onClick={() => onNext(Array.from(selected))}
          disabled={!canContinue}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button shadow-glow-standard disabled:opacity-30 disabled:shadow-none"
        >
          {canContinue ? t('onboarding.step2.cta' as never) : t('onboarding.step2.cta_disabled' as never)}
        </button>
      </div>
    </div>
  )
}
