import { useTranslation } from '@/lib/i18n'
import type { UserStats } from '@/types/db'

interface Props {
  summary: UserStats['summary']
}

function formatMinutes(n: number): string {
  if (n < 60) return `${n}m`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function StatsSummary({ summary }: Props) {
  const { t } = useTranslation()

  const tiles: Array<{ label: string; value: string; sub?: string }> = [
    { label: t('stats.summary.workouts'), value: String(summary.total_workouts) },
    { label: t('stats.summary.minutes'), value: formatMinutes(summary.total_minutes) },
    { label: t('stats.summary.xp'), value: summary.total_xp.toLocaleString() },
    { label: t('stats.summary.level'), value: `L${summary.level}` },
    {
      label: t('stats.summary.cards'),
      value: `${summary.card_count}`,
      sub: `/ ${summary.card_total_pool}`,
    },
    {
      label: t('stats.summary.arena'),
      value: `${summary.arena_wins}W`,
      sub: `/ ${summary.arena_losses}L`,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="bg-bg-secondary border border-white/10 rounded-card px-5 py-4"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-2">
            {tile.label}
          </div>
          <div className="font-display text-2xl font-bold tabular-nums text-text-primary">
            {tile.value}
            {tile.sub && (
              <span className="ml-1 text-sm text-text-tertiary font-normal">{tile.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
