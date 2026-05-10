import { useCallback, useEffect, useRef, useState } from 'react'
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
  /** Fired once all cards are revealed AND the last flip animation has played. */
  onComplete?: () => void
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
const REVEAL_DELAY_MS = 1000
const FLIP_ANIM_MS = 600

export default function CardReveal3({ cards, skipAnimation = false, onComplete }: Props) {
  const [revealed, setRevealed] = useState<boolean[]>(
    skipAnimation ? cards.map(() => true) : cards.map(() => false),
  )
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Idempotent skip path → fire immediately so caller can enable CTA.
  useEffect(() => {
    if (skipAnimation && !completedRef.current) {
      completedRef.current = true
      onCompleteRef.current?.()
    }
  }, [skipAnimation])

  // Auto-flip schedule.
  useEffect(() => {
    if (skipAnimation) return
    const timers: number[] = []
    FLIP_DELAYS_MS.slice(0, cards.length).forEach((delay, i) => {
      timers.push(
        window.setTimeout(() => {
          setRevealed((prev) => {
            if (prev[i]) return prev
            const next = [...prev]
            next[i] = true
            return next
          })
        }, REVEAL_DELAY_MS + delay),
      )
    })
    return () => timers.forEach(clearTimeout)
  }, [skipAnimation, cards.length])

  // User-driven reveal: clicking the back face flips that card now.
  const flipNow = useCallback((idx: number) => {
    setRevealed((prev) => {
      if (prev[idx]) return prev
      const next = [...prev]
      next[idx] = true
      return next
    })
  }, [])

  // Fire onComplete once all revealed AND last flip-animation has had time to play.
  useEffect(() => {
    if (completedRef.current) return
    if (!revealed.every(Boolean)) return
    completedRef.current = true
    const t = window.setTimeout(() => {
      onCompleteRef.current?.()
    }, FLIP_ANIM_MS)
    return () => clearTimeout(t)
  }, [revealed])

  return (
    <div className="flex items-center justify-center gap-4 md:gap-6 my-8">
      {cards.map((card, i) => (
        <CardSlotView
          key={card.id + ':' + i}
          card={card}
          revealed={revealed[i]}
          isCenter={i === 1}
          onClick={() => flipNow(i)}
        />
      ))}
    </div>
  )
}

function CardSlotView({
  card,
  revealed,
  isCenter,
  onClick,
}: {
  card: CardSlot
  revealed: boolean
  isCenter: boolean
  onClick: () => void
}) {
  const { lang } = useTranslation()
  const { data: cardData } = useCardById(card.id)

  const baseSize = isCenter ? 'w-[180px] h-[252px] md:w-[200px] md:h-[280px]' : 'w-[140px] h-[196px] md:w-[160px] md:h-[224px]'
  const centerScale = isCenter && revealed ? 'scale-105' : ''
  const haloClass = revealed ? RARITY_HALO[card.rarity] : ''

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={revealed}
      aria-label={revealed ? cardData?.name_zh ?? card.id : 'Reveal card'}
      className={`relative ${baseSize} transition-transform duration-500 ${centerScale} ${revealed ? 'cursor-default' : 'cursor-pointer hover:scale-[1.04] hover:-translate-y-1'}`}
    >
      {!revealed ? (
        <div className="absolute inset-0 bg-bg-secondary border-2 border-accent-primary/30 rounded-card overflow-hidden flex items-center justify-center">
          {/* Anticipation: pulsing accent ring + sliding shimmer + breathing "?" */}
          <div
            className="absolute inset-0 pointer-events-none animate-shimmer"
            style={{
              background:
                'linear-gradient(110deg, transparent 30%, rgba(182,255,60,0.18) 45%, rgba(182,255,60,0.28) 50%, rgba(182,255,60,0.18) 55%, transparent 70%)',
              backgroundSize: '200% 100%',
            }}
          />
          <div className="absolute inset-0 pointer-events-none animate-halo-pulse rounded-card" style={{ boxShadow: 'inset 0 0 24px rgba(182,255,60,0.25)' }} />
          <div className="font-display text-5xl text-accent-primary animate-pulse relative z-10 select-none">
            ?
          </div>
        </div>
      ) : (
        <div
          className={`absolute inset-0 bg-bg-secondary rounded-card p-4 flex flex-col border-2 ${RARITY_BORDER[card.rarity]} ${haloClass} animate-reveal-flip`}
        >
          <div className="flex items-start justify-between mb-3">
            <span
              className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-widest rounded-full border ${RARITY_BORDER[card.rarity]} ${RARITY_TEXT[card.rarity]}`}
            >
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
    </button>
  )
}
