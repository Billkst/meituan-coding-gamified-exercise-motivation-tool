import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import { ARENA } from '@/clash/lib/arena'
import type { Unit as UnitT } from '@/clash/engine/types'

interface Props {
  unit: UnitT
}

export default function Unit({ unit }: Props) {
  const card = CR_CARDS_BY_ID[unit.cardId]
  if (!card) return null

  const left = (unit.pos.x / ARENA.cols) * 100
  const top = (1 - unit.pos.y / ARENA.rows) * 100
  const isPlayer = unit.side === 'player'
  const isDying = unit.state === 'dying'
  const hpPct = Math.max(0, Math.min(1, unit.hp / unit.maxHp))
  const lowHp = hpPct < 0.5
  const ringColor = isPlayer ? 'border-accent-primary' : 'border-semantic-error'
  const opacity = isDying ? 0.4 : unit.state === 'spawning' ? 0.7 : 1

  return (
    <div
      className="absolute transition-none"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: 'translate(-50%, -50%)',
        opacity,
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        {/* HP bar */}
        <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden border border-white/10">
          <div
            className={'h-full transition-[width] duration-150 ' + (lowHp ? 'bg-semantic-error' : isPlayer ? 'bg-accent-primary' : 'bg-rarity-rare')}
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>
        {/* Body */}
        <div
          className={
            'w-9 h-9 rounded-full bg-bg-secondary border-2 ' + ringColor +
            ' flex items-center justify-center text-lg shadow-md ' +
            (unit.state === 'attacking' ? 'animate-pulse' : '')
          }
        >
          <span className="leading-none">{card.emoji}</span>
        </div>
      </div>
    </div>
  )
}
