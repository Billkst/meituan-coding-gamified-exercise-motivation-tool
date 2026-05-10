import { useTranslation } from '@/lib/i18n'
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest,
} from '@/api/friends'
import type { FriendListItem } from '@/types/db'

interface Props {
  user: FriendListItem
  direction: 'incoming' | 'outgoing'
}

export function InviteRow({ user, direction }: Props) {
  const { t } = useTranslation()
  const accept = useAcceptFriendRequest()
  const decline = useDeclineFriendRequest()
  const cancel = useCancelFriendRequest()

  const initial = user.username.charAt(0).toUpperCase()
  const isIncoming = direction === 'incoming'

  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-bg-tertiary border border-white/10 flex items-center justify-center font-display font-bold text-text-tertiary shrink-0">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold text-base truncate">{user.username}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary tabular-nums">
          L{user.level} · {user.season_score} {t('friends.score_unit')}
        </div>
      </div>
      {isIncoming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => accept.mutate(user.user_id)}
            disabled={accept.isPending}
            className="font-mono text-xs uppercase tracking-widest bg-accent-primary text-bg-primary py-2 px-3 rounded-button hover:shadow-glow-subtle disabled:opacity-50"
          >
            {t('friends.accept')}
          </button>
          <button
            type="button"
            onClick={() => decline.mutate(user.user_id)}
            disabled={decline.isPending}
            className="font-mono text-xs uppercase tracking-widest border border-white/10 text-text-secondary py-2 px-3 rounded-button hover:border-semantic-error hover:text-semantic-error disabled:opacity-50"
          >
            {t('friends.decline')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => cancel.mutate(user.user_id)}
          disabled={cancel.isPending}
          className="font-mono text-xs uppercase tracking-widest border border-white/10 text-text-secondary py-2 px-3 rounded-button hover:border-semantic-error hover:text-semantic-error disabled:opacity-50"
        >
          {t('friends.cancel')}
        </button>
      )}
    </div>
  )
}
