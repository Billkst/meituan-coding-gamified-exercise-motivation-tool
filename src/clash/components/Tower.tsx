import { ARENA } from '@/clash/lib/arena'
import type { Tower as TowerT } from '@/clash/engine/types'

interface Props {
  tower: TowerT
}

export default function Tower({ tower }: Props) {
  const left = (tower.pos.x / ARENA.cols) * 100
  const top = (1 - tower.pos.y / ARENA.rows) * 100
  const dead = tower.hp <= 0
  const isPlayer = tower.side === 'player'
  const hpPct = Math.max(0, Math.min(1, tower.hp / tower.maxHp))
  const lowHp = hpPct < 0.4
  const ringColor = isPlayer ? 'border-accent-primary' : 'border-semantic-error'
  const dormant = tower.isKing && !tower.isActive
  const icon = tower.isKing ? '👑' : '🏰'

  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: 'translate(-50%, -50%)',
        opacity: dead ? 0.3 : 1,
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className={'w-12 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/15 ' + (dead ? 'opacity-50' : '')}>
          <div
            className={'h-full transition-[width] duration-200 ' + (lowHp ? 'bg-semantic-error' : isPlayer ? 'bg-accent-primary' : 'bg-rarity-rare')}
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>
        <div
          className={
            'rounded-md border-2 ' + ringColor + ' flex items-center justify-center bg-bg-secondary shadow-md ' +
            (tower.isKing ? 'w-12 h-12 text-2xl' : 'w-10 h-10 text-xl') +
            (dormant ? ' opacity-50 grayscale' : '') +
            (dead ? ' line-through' : '')
          }
        >
          <span className="leading-none">{icon}</span>
        </div>
        <div className="font-mono text-[9px] text-text-tertiary tabular-nums">
          {Math.max(0, tower.hp)}
        </div>
      </div>
    </div>
  )
}
