import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { useSubmitWorkout } from '@/api/submitWorkout'
import type { Intensity, Sport } from '@/types/db'

// Inline emoji map (was src/lib/sportIcon.ts, deleted in Day 21 cleanup).
const SPORT_EMOJI: Record<string, string> = {
  running: '🏃', cycling: '🚴', swimming: '🏊', jump_rope: '🪢', hiit: '🔥',
  rowing: '🚣', weightlifting: '🏋️', boxing: '🥊', climbing: '🧗', calisthenics: '🤸',
  basketball: '🏀', football: '⚽', badminton: '🏸', pingpong: '🏓', tennis: '🎾',
  volleyball: '🏐', frisbee: '🥏', yoga: '🧘', pilates: '🤸', dance: '💃',
  tai_chi: '☯️', martial_arts: '🥋', judo: '🥋', hiking: '🥾', skateboard: '🛹', ski: '⛷️',
}
const sportEmoji = (id: string): string => SPORT_EMOJI[id] ?? '⚡'

const INTENSITIES: Intensity[] = ['light', 'medium', 'high']

export default function Workout() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const [sportId, setSportId] = useState('running')
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState<Intensity>('medium')

  const { data: sports } = useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sports')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw error
      return data as Sport[]
    },
  })

  const submit = useSubmitWorkout()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit.mutate(
      { sportId, durationMinutes: duration, intensity },
      {
        onSuccess: (r) => {
          navigate('/loot', { state: { result: r, ts: Date.now() } })
        },
      }
    )
  }

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('workout.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t('workout.title')}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-bg-secondary border border-white/10 rounded-card p-8 space-y-6 max-w-2xl"
      >
        {/* Sport */}
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary block mb-2">
            {t('workout.field.sport')}
          </label>
          <select
            value={sportId}
            onChange={(e) => setSportId(e.target.value)}
            className="w-full bg-bg-primary border border-white/10 rounded px-4 py-3 font-body text-base text-text-primary focus:border-accent-primary focus:outline-none"
          >
            {sports?.map((s) => (
              <option key={s.id} value={s.id}>
                {sportEmoji(s.id)}  {lang === 'zh' ? s.name_zh : s.name_en} ×{s.base_xp_multiplier}
              </option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary block mb-2">
            {t('workout.field.duration', { n: duration })}
          </label>
          <input
            type="range"
            min={5}
            max={180}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-accent-primary"
          />
          <div className="flex justify-between font-mono text-[10px] text-text-tertiary mt-1">
            <span>5m</span>
            <span>90m</span>
            <span>180m</span>
          </div>
        </div>

        {/* Intensity */}
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary block mb-2">
            {t('workout.field.intensity')}
          </label>
          <div className="flex gap-3">
            {INTENSITIES.map((i) => {
              const active = intensity === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntensity(i)}
                  className={
                    'flex-1 px-4 py-3 rounded-button border transition-all duration-150 ease-enter font-medium uppercase tracking-wider text-sm ' +
                    (active
                      ? 'border-accent-primary text-accent-primary shadow-glow-standard'
                      : 'border-white/10 text-text-secondary hover:border-white/30')
                  }
                >
                  {t(`workout.intensity.${i}` as TranslationKey)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submit.isPending || !sports}
          className="w-full bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-4 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.01] transition-all duration-150 ease-enter disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
        >
          {submit.isPending ? t('workout.submitting') : t('workout.submit')}
        </button>

        {/* Error */}
        {submit.isError && (
          <div className="bg-[#3a1212] border-l-2 border-semantic-error rounded-card px-4 py-3 flex items-center gap-3">
            <i className="ti ti-alert-circle text-xl text-semantic-error" />
            <span className="text-sm">
              {t('workout.error', { msg: (submit.error as Error).message })}
            </span>
          </div>
        )}
      </form>
    </div>
  )
}
