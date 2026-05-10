import { useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useSports } from '@/api/sports'
import { sportEmoji, CATEGORY_GRADIENT, CATEGORY_ACCENT_BORDER, CATEGORY_GLOW } from '@/lib/sportIcon'

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
    <div className="flex-1 flex flex-col items-center px-4 md:px-8 overflow-y-auto pb-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2 text-center mt-4">
        {t('onboarding.step2.title' as never)}
      </h2>
      <div className="font-mono text-xs text-text-tertiary uppercase tracking-widest mb-6 tabular-nums">
        {t('onboarding.step2.selected' as never, { n: selected.size } as never)}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-w-3xl w-full mb-8">
        {sports.map((sp, i) => {
          const on = selected.has(sp.id)
          const order = on ? Array.from(selected).indexOf(sp.id) + 1 : null
          return (
            <button
              key={sp.id}
              type="button"
              onClick={() => toggle(sp.id)}
              style={{ animationDelay: `${i * 25}ms` }}
              className={
                'group relative flex flex-col items-center gap-2 p-3 rounded-card border-2 transition-all duration-200 ease-enter aspect-[3/4] ' +
                (on
                  ? CATEGORY_ACCENT_BORDER[sp.category] + ' bg-bg-secondary -translate-y-1 ' + CATEGORY_GLOW[sp.category]
                  : 'border-white/10 bg-bg-secondary hover:border-white/30 hover:-translate-y-0.5 ')
              }
            >
              {/* Selection rank chip */}
              {on && order != null && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent-primary text-bg-primary font-display font-black text-[11px] tabular-nums flex items-center justify-center shadow-glow-standard">
                  {order}
                </div>
              )}

              {/* Icon tile — gradient by category, like an app icon */}
              <div
                className={
                  'w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ' +
                  CATEGORY_GRADIENT[sp.category] + ' ' +
                  (on ? 'scale-110 shadow-lg' : 'shadow-md')
                }
              >
                <span
                  className="text-3xl leading-none select-none"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                  aria-hidden
                >
                  {sportEmoji(sp.id)}
                </span>
              </div>

              {/* Name */}
              <div className="font-display font-bold text-[13px] text-center text-text-primary leading-tight line-clamp-2">
                {lang === 'zh' ? sp.name_zh : sp.name_en}
              </div>

              {/* Subtle xp multiplier badge */}
              <div className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary tabular-nums mt-auto">
                ×{sp.base_xp_multiplier} XP
              </div>

              {/* Confirm checkmark when selected (subtle) */}
              {on && (
                <div className="absolute bottom-1.5 left-1.5 w-4 h-4 rounded-full bg-accent-primary/90 flex items-center justify-center">
                  <IconCheck size={10} className="text-bg-primary" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onPrev}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.prev' as never)}
        </button>
        <button
          type="button"
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
