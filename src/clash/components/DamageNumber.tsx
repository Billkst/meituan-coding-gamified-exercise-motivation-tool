import { ARENA } from '@/clash/lib/arena'
import type { DamageEvent } from '@/clash/engine/types'

interface Props {
  event: DamageEvent
}

const KIND_COLOR: Record<DamageEvent['kind'], string> = {
  normal: 'text-semantic-error',
  crit: 'text-rarity-epic',
  tower: 'text-accent-warning',
}

export default function DamageNumber({ event }: Props) {
  const left = (event.pos.x / ARENA.cols) * 100
  const top = (1 - event.pos.y / ARENA.rows) * 100
  // ttl decays from 0.7 → 0; renderer uses ttl to fade.
  const fade = event.ttl / 0.7
  const lift = (1 - fade) * 30 // px upward
  return (
    <div
      className={'absolute pointer-events-none font-display font-bold tabular-nums text-base ' + KIND_COLOR[event.kind]}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, calc(-150% - ${lift}px))`,
        opacity: fade,
        textShadow: '0 0 6px rgba(0,0,0,0.7)',
      }}
    >
      -{event.amount}
    </div>
  )
}
