import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { cardEmoji } from '@/lib/cardArt'
import type { OwnedCard } from '@/api/cards'
import type { Rarity } from '@/types/db'

const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common']

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

interface Props {
  ownedCards: OwnedCard[]
  selectedIds: string[]
  onPick(cardId: string): void
}

export default function CardPicker({ ownedCards, selectedIds, onPick }: Props) {
  const { lang } = useTranslation()
  const [filter, setFilter] = useState<Rarity | 'all'>('all')

  const filtered = ownedCards.filter(c =>
    filter === 'all' || c.card.rarity === filter
  )

  return (
    <div>
      <div className="flex gap-2 mb-4 font-mono text-[10px] uppercase tracking-widest">
        <button
          onClick={() => setFilter('all')}
          className={'px-3 py-1 rounded-full border ' + (filter === 'all' ? 'border-accent-primary text-accent-primary' : 'border-white/10 text-text-tertiary')}
        >ALL</button>
        {RARITY_ORDER.map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={'px-3 py-1 rounded-full border ' + (filter === r ? `border-rarity-${r} text-rarity-${r}` : 'border-white/10 text-text-tertiary')}
          >{r}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(oc => {
          const picked = selectedIds.includes(oc.card_id)
          return (
            <button
              key={oc.card_id}
              type="button"
              onClick={() => !picked && onPick(oc.card_id)}
              disabled={picked}
              className={
                'text-left bg-bg-secondary rounded-card p-3 border transition-all ' +
                RARITY_BORDER[oc.card.rarity] + ' ' +
                (picked ? 'opacity-40 cursor-not-allowed ' : 'hover:scale-[1.02] cursor-pointer ')
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-xl flex-shrink-0" aria-hidden>{cardEmoji(oc.card)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-sm truncate">
                    {lang === 'zh' ? oc.card.name_zh : oc.card.name_en}
                  </div>
                  <div className="font-mono text-[10px] tabular-nums text-text-secondary mt-0.5">
                    ATK {oc.card.base_attack} · DEF {oc.card.base_defense} · ★{oc.star_level}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
