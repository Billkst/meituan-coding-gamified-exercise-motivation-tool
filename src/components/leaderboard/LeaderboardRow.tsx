import { IconFlame } from '@tabler/icons-react'
import type { LeaderboardEntry } from '@/api/leaderboard'

interface Props {
  entry: LeaderboardEntry
}

const MEDAL: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

export function LeaderboardRow({ entry: e }: Props) {
  return (
    <div
      className={
        'flex items-center gap-4 py-3 px-4 rounded-card transition-colors ' +
        (e.is_self
          ? 'bg-accent-primary/10 border-l-2 border-accent-primary'
          : 'hover:bg-bg-tertiary/40')
      }
    >
      <div className="w-12 text-center font-mono text-sm text-text-tertiary tabular-nums flex-shrink-0">
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
      <div className="font-mono text-xs text-text-tertiary tabular-nums w-12 text-center">
        L{e.level}
      </div>
      <div className="flex items-center gap-1 w-16 justify-end">
        <IconFlame size={14} className={e.streak > 0 ? 'text-accent-primary' : 'text-text-tertiary/40'} />
        <span className="font-mono text-xs tabular-nums text-text-secondary">{e.streak}</span>
      </div>
      <div className="font-mono text-sm text-text-primary tabular-nums w-20 text-right">
        {e.score.toLocaleString()}
      </div>
    </div>
  )
}
