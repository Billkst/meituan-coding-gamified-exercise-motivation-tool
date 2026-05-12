import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useLeaderboard, type LeaderboardPeriod } from '@/api/leaderboard'

const PERIODS: LeaderboardPeriod[] = ['all', 'month', 'week']

export default function Leaderboard() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const { data, isLoading, error } = useLeaderboard(period)

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 pl-14 md:pl-8 py-8 md:py-12">
      <header className="mb-8">
        <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
          {t('leaderboard.section' as never)}
        </div>
        <h1 className="font-display font-bold text-3xl uppercase tracking-tight">
          {t('leaderboard.title' as never)}
        </h1>
        {data && (
          <div className="font-mono text-xs text-text-tertiary mt-1">
            {data.total_users} {t('leaderboard.summary.total_users' as never)}
          </div>
        )}
      </header>

      {/* Period tabs */}
      <div className="flex gap-2 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={
              'font-mono uppercase text-xs py-2 px-4 rounded-button border transition-colors ' +
              (period === p
                ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                : 'border-white/15 text-text-secondary hover:border-white/30')
            }
          >
            {t(`leaderboard.tabs.${p}` as never)}
          </button>
        ))}
      </div>

      {/* Self rank */}
      {data && data.user_rank != null && (
        <div className="bg-bg-secondary border border-accent-primary/40 rounded-card px-4 py-3 mb-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-1">
            {t('leaderboard.self.title' as never)}
          </div>
          <div className="font-display text-2xl font-bold text-accent-primary">
            {t('leaderboard.self.your_rank' as never, { n: data.user_rank })}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mt-0.5">
            {t('leaderboard.self.percentile' as never, { n: data.user_percentile })}
          </div>
        </div>
      )}

      {/* Entries */}
      {isLoading && (
        <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary animate-pulse text-center py-8">
          {t('leaderboard.loading' as never)}
        </div>
      )}
      {error && (
        <div className="font-mono text-xs text-semantic-error text-center py-8">
          {String((error as Error).message ?? 'error')}
        </div>
      )}
      {data && data.entries.length === 0 && !isLoading && (
        <div className="font-mono text-xs text-text-tertiary text-center py-8 border border-dashed border-white/10 rounded-card">
          {t('leaderboard.empty' as never)}
        </div>
      )}
      {data && data.entries.length > 0 && (
        <>
          {/* Column header — aligns with each row's 3-column layout (rank w-10
              · player flex-1 · score) so users know what the number means. */}
          <div className="flex items-center gap-3 px-4 pb-2 mb-1 border-b border-white/5 font-mono text-[9px] uppercase tracking-widest text-text-tertiary">
            <div className="w-10 text-center">{t('leaderboard.col.rank' as never)}</div>
            <div className="flex-1">{t('leaderboard.col.player' as never)}</div>
            <div>{t('leaderboard.col.score' as never)}</div>
          </div>
        <ul className="space-y-2">
          {data.entries.map((e) => (
            <li
              key={e.user_id}
              className={
                'flex items-center gap-3 px-4 py-3 rounded-card border ' +
                (e.is_self
                  ? 'bg-accent-primary/10 border-accent-primary/50'
                  : 'bg-bg-secondary border-white/10')
              }
            >
              <div
                className={
                  'font-display font-bold text-lg w-10 text-center tabular-nums ' +
                  (e.rank === 1
                    ? 'text-rarity-legendary'
                    : e.rank === 2
                      ? 'text-text-secondary'
                      : e.rank === 3
                        ? 'text-rarity-rare'
                        : 'text-text-tertiary')
                }
              >
                {e.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm truncate">
                  {e.username ?? `User ${e.user_id.slice(0, 6)}`}
                  {e.is_self && (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-accent-primary">
                      you
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
                  lvl {e.level} · streak {e.streak}
                </div>
              </div>
              <div className="font-display text-lg font-bold tabular-nums text-accent-primary">
                {e.score}
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  )
}
