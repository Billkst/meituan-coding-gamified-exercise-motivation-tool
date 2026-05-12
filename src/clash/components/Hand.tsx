// Player's hand strip: 4 active cards + next-up preview.
// Cards become draggable when affordable; pointer-down on a card starts a drag.

import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import { useTranslation } from '@/lib/i18n'

interface Props {
  pile: CrCardId[]
  elixir: number
  draggingHandIndex: number | null
  onDragStart: (handIndex: number, e: React.PointerEvent<HTMLDivElement>) => void
}

export default function Hand({ pile, elixir, draggingHandIndex, onDragStart }: Props) {
  const { t } = useTranslation()
  const handCards = pile.slice(0, 4)
  const next = pile[4]

  return (
    <div data-tour="clash.hand" className="px-3 py-2 bg-bg-secondary/80 backdrop-blur border-t border-white/10 select-none">
      <div className="max-w-md mx-auto flex items-end gap-2">
        {/* 4 hand cards — min-w-0 lets cards shrink below content-size so the
            next-preview always has room (otherwise card emoji + badges push
            the preview off the right edge at viewport < 400px). */}
        <div className="flex-1 flex gap-2 min-w-0">
          {handCards.map((cardId, i) => (
            <HandCard
              key={`${cardId}_${i}`}
              cardId={cardId}
              handIndex={i}
              elixir={elixir}
              dragging={draggingHandIndex === i}
              onDragStart={onDragStart}
            />
          ))}
        </div>
        {/* Next preview — flex-shrink-0 so it keeps full size on narrow screens. */}
        <div className="flex-shrink-0 ml-1 pl-2 border-l border-white/10">
          <div className="font-mono text-[8px] uppercase tracking-widest text-text-tertiary mb-1 text-center">
            {t('clash.match.next_card' as never)}
          </div>
          <NextPreview cardId={next} />
        </div>
      </div>
    </div>
  )
}

function HandCard({
  cardId,
  handIndex,
  elixir,
  dragging,
  onDragStart,
}: {
  cardId: CrCardId
  handIndex: number
  elixir: number
  dragging: boolean
  onDragStart: (i: number, e: React.PointerEvent<HTMLDivElement>) => void
}) {
  const card = CR_CARDS_BY_ID[cardId]
  if (!card) return null
  const affordable = elixir >= card.cost
  return (
    <div
      onPointerDown={(e) => {
        if (!affordable) return
        e.preventDefault()
        onDragStart(handIndex, e)
      }}
      className={
        'relative flex-1 min-w-0 aspect-[3/4] rounded-card border-2 flex flex-col items-center justify-center transition-all ' +
        (affordable
          ? 'border-accent-primary bg-bg-primary cursor-grab active:cursor-grabbing hover:scale-[1.04] hover:-translate-y-1'
          : 'border-white/15 bg-bg-secondary opacity-50 cursor-not-allowed') +
        (dragging ? ' opacity-30 scale-95' : '')
      }
      role="button"
      aria-label={card.name_zh}
    >
      <div className="text-2xl leading-none">{card.emoji}</div>
      <div className="absolute top-1 right-1 bg-rarity-epic text-bg-primary font-display font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
        {card.cost}
      </div>
      <div className="absolute bottom-0.5 left-1 right-1 font-display text-[9px] text-text-secondary text-center truncate">
        {card.name_zh}
      </div>
    </div>
  )
}

function NextPreview({ cardId }: { cardId: CrCardId | undefined }) {
  if (!cardId) return <div className="w-12 h-16" />
  const card = CR_CARDS_BY_ID[cardId]
  if (!card) return null
  return (
    <div className="w-10 h-12 rounded-card border border-white/15 bg-bg-primary/60 flex flex-col items-center justify-center opacity-60">
      <div className="text-base leading-none">{card.emoji}</div>
      <div className="absolute mt-7 font-display text-[9px] text-rarity-epic font-bold">{card.cost}</div>
    </div>
  )
}
