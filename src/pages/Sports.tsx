import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { tablerClass, CATEGORY_GRADIENT } from '@/lib/sportIcon'
import type { Sport, SportCategory } from '@/types/db'

const CATEGORY_ORDER: SportCategory[] = [
  'cardio',
  'strength',
  'ball',
  'flex',
  'martial',
  'outdoor',
]

export default function Sports() {
  const { t, lang } = useTranslation()

  const { data, isLoading, error, refetch } = useQuery({
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

  const grouped = (data ?? []).reduce<Record<SportCategory, Sport[]>>(
    (acc, s) => {
      acc[s.category] ??= []
      acc[s.category].push(s)
      return acc
    },
    {} as Record<SportCategory, Sport[]>
  )

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('sports.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t('sports.title')}
      </h1>

      {isLoading && (
        <div className="bg-bg-secondary border border-white/10 rounded-card p-8 text-text-secondary">
          {t('sports.loading')}
        </div>
      )}

      {error && (
        <div className="bg-[#3a1212] border-l-2 border-semantic-error rounded-card p-6 mb-4 flex items-center gap-3">
          <i className="ti ti-alert-circle text-xl text-semantic-error" />
          <span className="flex-1 text-sm">
            {t('sports.error', { msg: (error as Error).message })}
          </span>
          <button
            onClick={() => refetch()}
            className="font-mono text-xs uppercase tracking-widest text-accent-primary"
          >
            {t('sports.retry')}
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="bg-bg-secondary border border-white/10 rounded-card p-8 text-text-secondary text-center">
          <i className="ti ti-database-off text-5xl text-text-tertiary block mb-4" />
          <p>{t('sports.empty')}</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-8">
          {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
            <section key={cat}>
              <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-3">
                {t(`sports.cat.${cat}` as TranslationKey)} ·{' '}
                <span className="text-text-secondary">{grouped[cat].length}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {grouped[cat].map((s) => (
                  <div
                    key={s.id}
                    className="bg-bg-secondary border border-white/10 rounded-card p-4 hover:border-accent-primary hover:bg-bg-tertiary transition-all duration-150 ease-enter cursor-pointer group"
                  >
                    <div
                      className={
                        'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform ' +
                        CATEGORY_GRADIENT[s.category]
                      }
                    >
                      <i className={`${tablerClass(s.icon)} text-2xl text-white`} />
                    </div>
                    <div className="font-display font-bold text-sm uppercase tracking-tight">
                      {lang === 'zh' ? s.name_zh : s.name_en}
                    </div>
                    <div className="font-mono text-[10px] text-text-tertiary mt-1">
                      ×{s.base_xp_multiplier} XP
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
