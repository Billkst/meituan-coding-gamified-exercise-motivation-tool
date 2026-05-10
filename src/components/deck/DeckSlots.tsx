import { IconX } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { cardEmoji } from '@/lib/cardArt'
import type { OwnedCard } from '@/api/cards'
import type { Rarity } from '@/types/db'

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

interface Props {
  slots: (OwnedCard | null)[]  // length 8
  onRemove(slotIdx: number): void
}

export default function DeckSlots({ slots, onRemove }: Props) {
  const { t, lang } = useTranslation()
  return (
    <div className="grid grid-cols-4 gap-3">
      {slots.map((s, i) => s ? (
        <div
          key={i}
          className={
            'relative bg-bg-secondary rounded-card p-3 border ' +
            RARITY_BORDER[s.card.rarity]
          }
        >
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-1 right-1 p-1 rounded-full hover:bg-bg-primary"
            aria-label="remove"
          >
            <IconX size={12} className="text-text-tertiary" />
          </button>
          <div className="text-2xl text-center mb-1" aria-hidden>{cardEmoji(s.card)}</div>
          <div className="font-display font-bold text-sm mb-1 truncate">
            {lang === 'zh' ? s.card.name_zh : s.card.name_en}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-text-secondary">
            ATK {s.card.base_attack} · DEF {s.card.base_defense} · ★{s.star_level}
          </div>
        </div>
      ) : (
        <div
          key={i}
          className="aspect-[3/4] border border-dashed border-white/10 rounded-card flex items-center justify-center font-mono text-xs text-text-tertiary uppercase tracking-widest"
        >
          {t('deck.empty_slot')}
        </div>
      ))}
    </div>
  )
}
