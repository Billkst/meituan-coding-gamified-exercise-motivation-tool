import { useTranslation } from '@/lib/i18n'
import { useSports } from '@/api/sports'
import type { UserStats } from '@/types/db'

interface Props {
  data: UserStats['sport_breakdown']
}

export function SportBreakdownChart({ data }: Props) {
  const { t, lang } = useTranslation()
  const { data: sports } = useSports()

  if (data.length === 0) {
    return (
      <section className="bg-bg-secondary border border-white/10 rounded-card p-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
          {t('stats.sport_breakdown.title')}
        </h2>
        <div className="font-mono text-sm text-text-tertiary text-center py-8">
          {t('stats.sport_breakdown.empty')}
        </div>
      </section>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count))
  const sportMap = new Map((sports ?? []).map((s) => [s.id, s]))

  return (
    <section className="bg-bg-secondary border border-white/10 rounded-card p-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
        {t('stats.sport_breakdown.title')}
      </h2>
      <div className="space-y-3">
        {data.map((row, idx) => {
          const sport = sportMap.get(row.sport_id)
          const name = sport ? (lang === 'zh' ? sport.name_zh : sport.name_en) : row.sport_id
          const widthPct = (row.count / maxCount) * 100
          const tone =
            idx === 0
              ? 'bg-accent-primary'
              : idx <= 2
              ? 'bg-accent-primary/60'
              : 'bg-text-tertiary/30'

          return (
            <div key={row.sport_id} className="flex items-center gap-3">
              <div className="w-20 font-body text-sm text-text-primary truncate">{name}</div>
              <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div className={'h-full transition-all ' + tone} style={{ width: `${widthPct}%` }} />
              </div>
              <div className="font-mono text-[10px] text-text-tertiary tabular-nums w-24 text-right">
                {row.count} · {row.total_minutes}
                {t('stats.sport_breakdown.minutes_suffix')}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
