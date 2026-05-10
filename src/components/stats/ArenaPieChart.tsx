import { useTranslation } from '@/lib/i18n'
import type { UserStats } from '@/types/db'

interface Props {
  data: UserStats['arena']
}

const CX = 100
const CY = 100
const R = 70
const STROKE_W = 14

export function ArenaPieChart({ data }: Props) {
  const { t } = useTranslation()
  const hasBattles = data.battles_total > 0

  // Build the wins arc path: starts at left endpoint (180°), sweeps clockwise across top.
  let winsPath = ''
  if (hasBattles && data.wins > 0) {
    const winsFraction = data.wins / data.battles_total
    const endAngleDeg = 180 - 180 * winsFraction
    const endRad = (endAngleDeg * Math.PI) / 180
    const endX = CX + R * Math.cos(endRad)
    const endY = CY - R * Math.sin(endRad)
    const startX = CX - R
    const startY = CY
    const largeArc = winsFraction > 0.5 ? 1 : 0
    winsPath = `M ${startX},${startY} A ${R},${R} 0 ${largeArc},1 ${endX},${endY}`
  }

  return (
    <section className="bg-bg-secondary border border-white/10 rounded-card p-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
        {t('stats.arena.title')}
      </h2>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 120" className="w-48 h-auto" preserveAspectRatio="xMidYMid meet">
          {/* base half-circle (loss tone) */}
          <path
            d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_W}
            strokeLinecap="butt"
            className={hasBattles ? 'text-semantic-error/60' : 'text-text-tertiary/20'}
          />
          {/* wins arc on top */}
          {winsPath && (
            <path
              d={winsPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_W}
              strokeLinecap="butt"
              className="text-accent-primary"
            />
          )}
          {/* center label */}
          <text
            x={CX}
            y={CY - 8}
            textAnchor="middle"
            className="fill-text-primary font-display font-bold"
            style={{ fontSize: 28 }}
          >
            {hasBattles ? `${data.win_rate_pp}%` : '—'}
          </text>
        </svg>

        {hasBattles ? (
          <>
            <div className="font-mono text-sm text-text-primary tabular-nums mt-2">
              {t('stats.arena.wins_losses', { w: data.wins, l: data.losses })}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mt-1 tabular-nums">
              {t('stats.arena.battles', { n: data.battles_total })}
            </div>
          </>
        ) : (
          <div className="font-mono text-sm text-text-tertiary mt-2">{t('stats.arena.empty')}</div>
        )}
      </div>
    </section>
  )
}
