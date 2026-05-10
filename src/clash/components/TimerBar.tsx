import { ARENA } from '@/clash/lib/arena'
import type { MatchPhase } from '@/clash/engine/types'
import { useTranslation } from '@/lib/i18n'

interface Props {
  elapsed: number
  phase: MatchPhase
}

function fmtTime(sec: number): string {
  const total = Math.max(0, Math.ceil(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TimerBar({ elapsed, phase }: Props) {
  const { t } = useTranslation()
  const isMain = phase === 'main' || phase === 'pregame'
  const remaining = isMain
    ? ARENA.matchSeconds - elapsed
    : ARENA.matchSeconds + ARENA.overtimeSeconds - elapsed

  return (
    <div className="text-center">
      <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
        {isMain ? t('clash.match.timer_main' as never, { time: '' }) : t('clash.match.timer_overtime' as never, { time: '' })}
      </div>
      <div
        className={
          'font-display text-2xl font-bold tabular-nums ' +
          (phase === 'overtime'
            ? 'text-rarity-legendary animate-pulse'
            : remaining < 30
            ? 'text-semantic-error'
            : 'text-text-primary')
        }
      >
        {fmtTime(remaining)}
      </div>
    </div>
  )
}
