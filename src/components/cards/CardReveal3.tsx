import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useCardById } from '@/api/cards'
import { cardEmoji } from '@/lib/cardArt'
import type { Rarity } from '@/types/db'

interface CardSlot {
  id: string
  rarity: Rarity
}

interface Props {
  cards: CardSlot[]
  /** Skip the flip animation (used when revisiting an already-revealed pack). */
  skipAnimation?: boolean
}

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

const RARITY_HALO: Record<Rarity, string> = {
  common: '',
  rare: 'shadow-[0_0_20px_rgba(60,140,255,0.4)]',
  epic: 'shadow-[0_0_28px_rgba(156,60,255,0.55)] animate-halo-pulse',
  legendary: 'shadow-glow-legendary animate-halo-pulse',
}

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

const FLIP_DELAYS_MS = [0, 300, 600]

export default function CardReveal3({ cards, skipAnimation = false }: Props) {
  const [revealed, setRevealed] = useState<boolean[]>(
    skipAnimation ? cards.map(() => true) : cards.map(() => false)
  )

  useEffect(() => {
    if (skipAnimation) return
    const timers = FLIP_DELAYS_MS.slice(0, cards.length).map((delay, i) =>
      setTimeout(() => {
        setRevealed((prev) => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 1000 + delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [skipAnimation, cards.length])

  return (
    <div className="flex items-center justify-center gap-6 my-8">
      {cards.map((card, i) => (
        <CardSlotView key={card.id + ':' + i} card={card} revealed={revealed[i]} isCenter={i === 1} />
      ))}
    </div>
  )
}

function CardSlotView({ card, revealed, isCenter }: { card: CardSlot; revealed: boolean; isCenter: boolean }) {
  const { lang } = useTranslation()
  const { data: cardData } = useCardById(card.id)

  const baseSize = isCenter ? 'w-[200px] h-[280px]' : 'w-[160px] h-[224px]'
  const centerScale = isCenter && revealed ? 'scale-105' : ''
  const haloClass = revealed ? RARITY_HALO[card.rarity] : ''

  return (
    <div className={`relative ${baseSize} transition-transform duration-500 ${centerScale}`}>
      {!revealed ? (
        <div className="absolute inset-0 bg-bg-secondary border border-white/20 rounded-card flex items-center justify-center">
          <div className="font-display text-4xl text-text-tertiary">?</div>
        </div>
      ) : (
        <div className={`absolute inset-0 bg-bg-secondary rounded-card p-4 flex flex-col border-2 ${RARITY_BORDER[card.rarity]} ${haloClass} animate-reveal-flip`}>
          <div className="flex items-start justify-between mb-3">
            <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-widest rounded-full border ${RARITY_BORDER[card.rarity]} ${RARITY_TEXT[card.rarity]}`}>
              {card.rarity}
            </span>
            <span className="font-mono text-[9px] text-text-tertiary uppercase">{card.id}</span>
          </div>
          <div className="flex-1 flex flex-col justify-center text-center">
            {cardData && (
              <div className={'mb-2 ' + (isCenter ? 'text-4xl' : 'text-3xl')} aria-hidden>
                {cardEmoji(cardData)}
              </div>
            )}
            <div className="font-display font-bold text-xl text-text-primary mb-2">
              {cardData ? (lang === 'zh' ? cardData.name_zh : cardData.name_en) : '...'}
            </div>
            <div className="font-body text-[11px] text-text-secondary leading-relaxed">
              {cardData ? (lang === 'zh' ? cardData.ability_text_zh : cardData.ability_text_en) : ''}
            </div>
          </div>
          <div className="border-t border-white/10 pt-2 flex items-center justify-between text-[10px]">
            <span className="font-mono text-text-tertiary uppercase">ATK / DEF</span>
            <span className="font-mono text-text-primary tabular-nums">
              {cardData?.base_attack ?? '—'} / {cardData?.base_defense ?? '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
