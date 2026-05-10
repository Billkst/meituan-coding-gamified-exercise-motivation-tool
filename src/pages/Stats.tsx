import { useTranslation } from '@/lib/i18n'
import { useUserStats } from '@/api/stats'
import { StatsSummary } from '@/components/stats/StatsSummary'
import { XpTrendChart } from '@/components/stats/XpTrendChart'
import { SportBreakdownChart } from '@/components/stats/SportBreakdownChart'
import { ArenaPieChart } from '@/components/stats/ArenaPieChart'
import { CardCollectionChart } from '@/components/stats/CardCollectionChart'

export default function Stats() {
  const { t } = useTranslation()
  const { data, isLoading } = useUserStats()

  if (isLoading) {
    return (
      <div className="max-w-container mx-auto px-8 py-12">
        <div className="font-mono text-sm text-text-tertiary">{t('stats.loading')}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-container mx-auto px-8 py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('stats.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-2">
        {t('stats.title')}
      </h1>
      <div className="font-mono text-sm text-text-secondary mb-12 tabular-nums">
        {t('stats.subline', {
          days: data.summary.joined_days,
          cur: data.summary.current_streak,
          max: data.summary.longest_streak,
        })}
      </div>

      <div className="space-y-8">
        <StatsSummary summary={data.summary} />
        <XpTrendChart data={data.xp_trend} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SportBreakdownChart data={data.sport_breakdown} />
          <ArenaPieChart data={data.arena} />
        </div>
        <CardCollectionChart data={data.card_collection} />
      </div>
    </div>
  )
}
