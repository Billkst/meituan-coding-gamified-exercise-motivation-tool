import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import type { Sport, SportCategory } from '@/types/db'

const CATEGORY_ORDER: SportCategory[] = [
  'cardio',
  'strength',
  'ball',
  'flex',
  'martial',
  'outdoor',
]

// Tabler webfont icons use kebab-case class names; convert IconRun → ti-run
function tablerClass(componentName: string): string {
  const kebab = componentName
    .replace(/^Icon/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
  return `ti ti-${kebab}`
}

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
    <div className="max-w-container mx-auto px-8 py-12">
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
                    className="bg-bg-secondary border border-white/10 rounded-card p-4 hover:border-accent-primary hover:bg-bg-tertiary transition-colors duration-150 ease-enter cursor-pointer group"
                  >
                    <i
                      className={`${tablerClass(s.icon)} text-3xl text-text-secondary group-hover:text-accent-primary block mb-3`}
                    />
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
