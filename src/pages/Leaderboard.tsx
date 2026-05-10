import { useMemo, useState } from 'react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { useLeaderboard, type LeaderboardPeriod } from '@/api/leaderboard'
import {
  useFriendsList,
  useSendFriendRequest,
  useAcceptFriendRequest,
} from '@/api/friends'
import { LeaderboardRow, type FriendStatus } from '@/components/leaderboard/LeaderboardRow'

const PERIODS: LeaderboardPeriod[] = ['all', 'month', 'week']

export default function Leaderboard() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const { data, isLoading } = useLeaderboard(period)
  const { data: friends } = useFriendsList()
  const sendInvite = useSendFriendRequest()
  const acceptInvite = useAcceptFriendRequest()
  const isMutating = sendInvite.isPending || acceptInvite.isPending

  const statusByUserId = useMemo(() => {
    const m = new Map<string, FriendStatus>()
    if (!friends) return m
    for (const f of friends.active)   m.set(f.user_id, 'active')
    for (const f of friends.incoming) m.set(f.user_id, 'incoming')
    for (const f of friends.outgoing) m.set(f.user_id, 'outgoing')
    return m
  }, [friends])

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('leaderboard.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t('leaderboard.title')}
      </h1>

      <div className="flex items-center gap-2 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={
              'font-mono text-xs uppercase tracking-widest py-2 px-4 rounded-button transition-colors ' +
              (p === period
                ? 'bg-accent-primary text-bg-primary'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary')
            }
          >
            {t(`leaderboard.tabs.${p}` as TranslationKey)}
          </button>
        ))}
        <div className="ml-auto font-mono text-xs text-text-tertiary tabular-nums">
          {data ? `${data.total_users} ${t('leaderboard.summary.total_users')}` : ''}
        </div>
      </div>

      {isLoading ? (
        <div className="font-mono text-sm text-text-tertiary">{t('leaderboard.loading')}</div>
      ) : !data ? null : (
        <>
          {data.user_rank !== null && (
            <div className="bg-bg-secondary border border-accent-primary rounded-card p-5 mb-6 shadow-glow-standard">
              <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-1">
                {t('leaderboard.self.title')}
              </div>
              <div className="flex items-baseline justify-between">
                <div className="font-display font-bold text-xl">
                  {t('leaderboard.self.your_rank', { n: data.user_rank })}
                </div>
                <div className="font-mono text-sm text-text-secondary tabular-nums">
                  {data.user_score?.toLocaleString() ?? '—'} XP
                </div>
              </div>
              {data.total_users > 1 && (
                <div className="font-mono text-xs text-text-tertiary mt-1">
                  {t('leaderboard.self.percentile', { n: data.user_percentile })}
                </div>
              )}
            </div>
          )}

          {data.entries.length === 0 ? (
            <div className="font-mono text-sm text-text-tertiary text-center py-8">
              {t('leaderboard.empty')}
            </div>
          ) : (
            <div className="bg-bg-secondary border border-white/10 rounded-card p-2">
              {data.entries.map((entry) => {
                const status: FriendStatus = entry.is_self
                  ? 'self'
                  : statusByUserId.get(entry.user_id) ?? 'none'
                return (
                  <LeaderboardRow
                    key={entry.user_id}
                    entry={entry}
                    friendStatus={status}
                    onAdd={(id) => sendInvite.mutate(id)}
                    onAccept={(id) => acceptInvite.mutate(id)}
                    isMutating={isMutating}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
