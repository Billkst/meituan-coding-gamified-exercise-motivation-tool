import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSports } from '@/api/sports'
import { sportEmoji } from '@/lib/sportIcon'

interface Props {
  onNext: () => void
  onPrev: () => void
  defaultSportId: string | null
}

type Intensity = 'light' | 'medium' | 'high'

export default function Step3MockWorkout({ onNext, onPrev, defaultSportId }: Props) {
  const { t, lang } = useTranslation()
  const { data: sports = [] } = useSports()
  const [sportId, setSportId] = useState(defaultSportId ?? sports[0]?.id ?? '')
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(onNext, 1500)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-8 text-center">
        {t('onboarding.step3.title' as never)}
      </h2>
      <div className="bg-bg-secondary border border-white/10 rounded-card p-6 w-full max-w-md space-y-6">
        <label className="block">
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-2">
            {t('onboarding.step3.sport' as never)}
          </div>
          <select
            value={sportId}
            onChange={(e) => setSportId(e.target.value)}
            className="w-full bg-bg-primary border border-white/20 rounded px-3 py-2 font-mono text-sm"
          >
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {sportEmoji(s.id)}  {lang === 'zh' ? s.name_zh : s.name_en}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-2">
            {t('onboarding.step3.duration' as never)}
          </div>
          <input
            type="number"
            min={1}
            max={600}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value || '0', 10))}
            className="w-full bg-bg-primary border border-white/20 rounded px-3 py-2 font-mono text-sm"
          />
        </label>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-2">
            {t('onboarding.step3.intensity_label' as never)}
          </div>
          <div className="flex gap-2">
            {(['light', 'medium', 'high'] as Intensity[]).map((it) => (
              <button
                key={it}
                onClick={() => setIntensity(it)}
                className={
                  'flex-1 py-2 rounded font-mono text-xs uppercase tracking-widest border transition ' +
                  (intensity === it
                    ? 'bg-accent-primary text-bg-primary border-accent-primary'
                    : 'border-white/20 text-text-secondary hover:border-white/40')
                }
              >
                {t(('onboarding.step3.intensity.' + it) as never)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {submitted && (
        <div className="font-display text-3xl font-bold text-accent-primary tabular-nums mt-6 animate-pulse">
          +60 XP
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={onPrev}
          disabled={submitted}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button disabled:opacity-30"
        >
          {t('onboarding.prev' as never)}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitted || !sportId}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button shadow-glow-standard disabled:opacity-30 disabled:shadow-none"
        >
          {t('onboarding.step3.cta' as never)}
        </button>
      </div>
    </div>
  )
}
