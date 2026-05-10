import { useNavigate } from 'react-router-dom'
import { IconSwords, IconUserMinus } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useStartPvpBattle } from '@/api/pvpBattle'
import { useUnfriend } from '@/api/friends'
import type { FriendListItem } from '@/types/db'

interface Props {
  friend: FriendListItem
}

export function FriendCard({ friend }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const startPvp = useStartPvpBattle()
  const unfriend = useUnfriend()

  const initial = friend.username.charAt(0).toUpperCase()
  const trainedToday =
    friend.last_workout_date &&
    friend.last_workout_date.slice(0, 10) === new Date().toISOString().slice(0, 10)

  function onPickPvp() {
    if (startPvp.isPending) return
    startPvp.mutate(friend.user_id, {
      onSuccess: (r) => {
        navigate(`/arena/battle/${r.battle_id}`, { state: { startResult: r } })
      },
    })
  }

  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-bg-tertiary border border-white/10 flex items-center justify-center font-display font-bold text-accent-primary shrink-0">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold text-base truncate">{friend.username}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary tabular-nums">
          L{friend.level} · {friend.season_score} {t('friends.score_unit')}
          {trainedToday && (
            <span className="ml-2 text-accent-primary">· {t('friends.trained_today')}</span>
          )}
          {!trainedToday && (friend.current_streak ?? 0) > 0 && (
            <span className="ml-2 text-text-secondary">· {friend.current_streak}d</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onPickPvp}
        disabled={startPvp.isPending}
        className="font-mono text-xs uppercase tracking-widest bg-accent-primary text-bg-primary py-2 px-3 rounded-button shadow-glow-subtle hover:shadow-glow-standard disabled:opacity-50 flex items-center gap-1"
      >
        <IconSwords size={14} />
        {t('friends.pvp_cta')}
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(t('friends.unfriend_confirm', { name: friend.username }))) {
            unfriend.mutate(friend.user_id)
          }
        }}
        aria-label={t('friends.unfriend')}
        className="text-text-tertiary hover:text-semantic-error p-1"
      >
        <IconUserMinus size={16} />
      </button>
      {startPvp.isError && (
        <div className="absolute mt-16 ml-0 text-xs font-mono text-semantic-error">
          {(startPvp.error as Error).message}
        </div>
      )}
    </div>
  )
}
