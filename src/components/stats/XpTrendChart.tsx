import { Link } from 'react-router-dom'
import { IconArrowRight } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { UserStats } from '@/types/db'

interface Props {
  data: UserStats['xp_trend']
}

const W = 800
const H = 200
const PAD_X = 30
const PAD_TOP = 24
const PAD_BOTTOM = 24

export function XpTrendChart({ data }: Props) {
  const { t } = useTranslation()
  const allZero = data.every((d) => d.xp === 0)

  if (allZero) {
    return (
      <section className="bg-bg-secondary border border-white/10 rounded-card p-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
          {t('stats.xp_trend.title')}
        </h2>
        <div className="text-center py-12">
          <Link
            to="/workout"
            className="inline-flex items-center gap-2 font-mono text-sm text-accent-primary hover:underline"
          >
            {t('stats.xp_trend.empty')}
            <IconArrowRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  const maxXp = Math.max(...data.map((d) => d.xp), 100)
  const avg = Math.round(data.reduce((acc, d) => acc + d.xp, 0) / data.length)
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_TOP - PAD_BOTTOM

  const xAt = (i: number) => PAD_X + (i / (data.length - 1)) * innerW
  const yAt = (xp: number) => PAD_TOP + innerH - (xp / maxXp) * innerH
  const avgY = yAt(avg)

  const points = data.map((d, i) => `${xAt(i)},${yAt(d.xp)}`).join(' ')
  const lastIdx = data.length - 1

  return (
    <section className="bg-bg-secondary border border-white/10 rounded-card p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
          {t('stats.xp_trend.title')}
        </h2>
        <div className="font-mono text-xs text-text-tertiary tabular-nums">
          {t('stats.xp_trend.avg_label')} {avg} XP
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* horizontal grid lines (4 levels) */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = PAD_TOP + innerH * frac
          return (
            <line
              key={frac}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.05}
              className="text-white"
            />
          )
        })}

        {/* avg line */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={avgY}
          y2={avgY}
          stroke="currentColor"
          strokeDasharray="4 4"
          className="text-text-tertiary/50"
        />

        {/* trend polyline */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
          className="text-accent-primary"
        />

        {/* data points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(d.xp)}
            r={i === lastIdx ? 4 : 2.5}
            className={i === lastIdx ? 'fill-accent-primary' : 'fill-accent-primary/70'}
          />
        ))}
      </svg>

      <div className="flex items-center justify-between mt-2 font-mono text-[10px] uppercase tracking-widest text-text-tertiary tabular-nums">
        <span>30d ago</span>
        <span>today</span>
      </div>
    </section>
  )
}
