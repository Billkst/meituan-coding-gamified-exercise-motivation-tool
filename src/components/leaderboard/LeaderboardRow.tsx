import { IconFlame, IconUserPlus, IconCheck } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { LeaderboardEntry } from '@/api/leaderboard'

export type FriendStatus = 'self' | 'active' | 'incoming' | 'outgoing' | 'none'

interface Props {
  entry: LeaderboardEntry
  friendStatus: FriendStatus
  onAdd: (userId: string) => void
  onAccept: (userId: string) => void
  isMutating: boolean
}

const MEDAL: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

export function LeaderboardRow({ entry: e, friendStatus, onAdd, onAccept, isMutating }: Props) {
  return (
    <div
      className={
        'flex items-center gap-3 py-3 px-4 rounded-card transition-colors ' +
        (e.is_self
          ? 'bg-accent-primary/10 border-l-2 border-accent-primary'
          : 'hover:bg-bg-tertiary/40')
      }
    >
      <div className="w-10 text-center font-mono text-sm text-text-tertiary tabular-nums flex-shrink-0">
        {MEDAL[e.rank] ?? `#${e.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={
            'font-display font-bold truncate ' +
            (e.is_self ? 'text-accent-primary' : 'text-text-primary')
          }
        >
          {e.username}
        </div>
      </div>
      <div className="font-mono text-xs text-text-tertiary tabular-nums w-10 text-center">
        L{e.level}
      </div>
      <div className="flex items-center gap-1 w-12 justify-end">
        <IconFlame size={14} className={e.streak > 0 ? 'text-accent-primary' : 'text-text-tertiary/40'} />
        <span className="font-mono text-xs tabular-nums text-text-secondary">{e.streak}</span>
      </div>
      <div className="font-mono text-sm text-text-primary tabular-nums w-16 text-right">
        {e.score.toLocaleString()}
      </div>
      <div className="w-24 flex justify-end">
        <FriendButton status={friendStatus} userId={e.user_id} onAdd={onAdd} onAccept={onAccept} isMutating={isMutating} />
      </div>
    </div>
  )
}

function FriendButton({
  status,
  userId,
  onAdd,
  onAccept,
  isMutating,
}: {
  status: FriendStatus
  userId: string
  onAdd: (id: string) => void
  onAccept: (id: string) => void
  isMutating: boolean
}) {
  const { t } = useTranslation()
  if (status === 'self') return null
  if (status === 'active') {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary inline-flex items-center gap-1">
        <IconCheck size={12} />
        {t('leaderboard.is_friend')}
      </span>
    )
  }
  if (status === 'outgoing') {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
        {t('leaderboard.invite_pending')}
      </span>
    )
  }
  if (status === 'incoming') {
    return (
      <button
        type="button"
        disabled={isMutating}
        onClick={() => onAccept(userId)}
        className="font-mono text-[10px] uppercase tracking-widest bg-accent-primary text-bg-primary py-1.5 px-2.5 rounded-button disabled:opacity-50"
      >
        {t('leaderboard.invite_incoming')}
      </button>
    )
  }
  return (
    <button
      type="button"
      disabled={isMutating}
      onClick={() => onAdd(userId)}
      aria-label={t('leaderboard.add_friend')}
      className="font-mono text-[10px] uppercase tracking-widest border border-white/10 hover:border-accent-primary text-text-secondary hover:text-accent-primary py-1.5 px-2 rounded-button disabled:opacity-50 inline-flex items-center gap-1"
    >
      <IconUserPlus size={12} />
      {t('leaderboard.add_friend')}
    </button>
  )
}
