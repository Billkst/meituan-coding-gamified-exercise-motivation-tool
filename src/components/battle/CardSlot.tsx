import { IconStarFilled } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { BattleCard } from '@/lib/battle/types'
import type { Rarity } from '@/types/db'

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

interface Props {
  card: BattleCard
  selectable: boolean
  selected?: boolean
  onClick?: () => void
  side: 'player' | 'opponent'
}

export default function CardSlot({ card, selectable, selected, onClick, side }: Props) {
  const { lang } = useTranslation()
  const c = card.card
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable || card.is_played}
      className={
        'relative aspect-[3/4] bg-bg-secondary rounded-card p-2 flex flex-col gap-1 border ' +
        RARITY_BORDER[c.rarity] + ' ' +
        (card.is_played ? 'opacity-30 grayscale ' : '') +
        (selectable ? 'cursor-pointer hover:scale-[1.04] transition-transform ' : 'cursor-default ') +
        (selected ? 'ring-2 ring-accent-primary shadow-glow-standard ' : '')
      }
    >
      <div className="flex justify-between items-start font-mono text-[8px] text-text-tertiary uppercase tracking-widest">
        <span>{c.id}</span>
        <span className="flex items-center gap-0.5">
          {Array.from({ length: card.star_level }).map((_, i) => (
            <IconStarFilled key={i} size={8} className="text-rarity-legendary" />
          ))}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center text-center px-1">
        <span className="font-display text-xs font-bold leading-tight">
          {lang === 'zh' ? c.name_zh : c.name_en}
        </span>
      </div>
      <div className="font-mono text-[9px] tabular-nums flex justify-between text-text-secondary">
        <span>ATK {c.base_attack}</span>
        <span>DEF {c.base_defense}</span>
      </div>
      {side === 'player' && card.is_played && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-text-tertiary">
          PLAYED
        </div>
      )}
    </button>
  )
}
