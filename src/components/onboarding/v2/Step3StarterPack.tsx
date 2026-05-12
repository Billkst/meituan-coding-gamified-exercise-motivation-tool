// Day 25 — Onboarding v2 / Step 3: Starter pack reveal.
//
// Click the chest → 6 cards flip in sequence (4 common + 1 rare + 1 epic
// as our "legendary" since the schema has no legendary cards yet). Each
// card uses a CSS 3D rotateY back→front flip with a sheen pass; the epic
// card gets an extended golden halo pulse for emphasis.
//
// State machine: closed → opening → revealing(i) → done.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { CR_CARDS_BY_ID, type CrCardId } from '@/clash/lib/cardData'

interface Props {
  onContinue: () => void
  onSkipTutorial: () => void
}

const PACK: { id: CrCardId; rarity: 'common' | 'rare' | 'epic' }[] = [
  { id: 'knight', rarity: 'common' },
  { id: 'archer', rarity: 'common' },
  { id: 'goblin', rarity: 'common' },
  { id: 'cannon', rarity: 'common' },
  { id: 'giant', rarity: 'rare' },
  { id: 'baby_dragon', rarity: 'epic' },
]

const REVEAL_INTERVAL_MS = 700

type Phase = 'closed' | 'opening' | 'revealing' | 'done'

export default function Step3StarterPack({ onContinue, onSkipTutorial }: Props) {
  const { t, lang } = useTranslation()
  const [phase, setPhase] = useState<Phase>('closed')
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    if (phase !== 'opening') return
    // Brief chest-opening sequence, then start revealing cards.
    const id = window.setTimeout(() => setPhase('revealing'), 600)
    return () => window.clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'revealing') return
    if (revealedCount >= PACK.length) {
      setPhase('done')
      return
    }
    const id = window.setTimeout(
      () => setRevealedCount((n) => n + 1),
      REVEAL_INTERVAL_MS,
    )
    return () => window.clearTimeout(id)
  }, [phase, revealedCount])

  const langKey = lang === 'zh' ? 'name_zh' : 'name_en'

  const banner = useMemo(() => {
    if (phase === 'closed') return t('onboarding.v2.step3.tap_to_open' as never)
    if (phase === 'opening') return t('onboarding.v2.step3.opening' as never)
    if (phase === 'done') return t('onboarding.v2.step3.done' as never)
    return t('onboarding.v2.step3.revealing' as never)
  }, [phase, t])

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col items-center justify-center px-6">
      <div className="font-mono text-[11px] uppercase tracking-widest text-accent-primary mb-2">
        {t('onboarding.v2.step3.tag' as never)}
      </div>
      <h1 className="font-display font-black text-3xl md:text-4xl uppercase tracking-tight text-text-primary mb-2 text-center">
        {t('onboarding.v2.step3.title' as never)}
      </h1>
      <p className="text-text-secondary text-sm mb-10 text-center">{banner}</p>

      {phase === 'closed' ? (
        <button
          onClick={() => setPhase('opening')}
          className="group focus:outline-none"
          aria-label={t('onboarding.v2.step3.tap_to_open' as never)}
        >
          <ChestIcon pulse />
        </button>
      ) : phase === 'opening' ? (
        <ChestIcon opening />
      ) : (
        <div className="grid grid-cols-3 gap-3 md:gap-5 max-w-md w-full">
          {PACK.map((c, i) => {
            const revealed = revealedCount > i
            const card = CR_CARDS_BY_ID[c.id]
            const cardName = card ? card[langKey] : c.id
            return (
              <Card
                key={c.id}
                rarity={c.rarity}
                revealed={revealed}
                name={cardName}
                emoji={card?.emoji ?? '?'}
              />
            )
          })}
        </div>
      )}

      {phase === 'done' && (
        <>
          <button
            onClick={onContinue}
            className="mt-10 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:scale-[1.02] transition-transform"
          >
            {t('onboarding.v2.step3.cta' as never)}
          </button>
          <button
            onClick={onSkipTutorial}
            className="mt-3 font-mono text-[10px] uppercase tracking-widest text-text-tertiary hover:text-text-primary underline"
          >
            {t('onboarding.v2.tutorial.skip' as never)}
          </button>
        </>
      )}

      <div className="mt-12 font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
        {t('onboarding.v2.step_indicator' as never, { n: 3, total: 4 })}
      </div>
    </div>
  )
}

function ChestIcon({ pulse, opening }: { pulse?: boolean; opening?: boolean }) {
  return (
    <div
      className={
        'relative w-40 h-40 flex items-center justify-center text-8xl select-none transition-transform ' +
        (opening ? 'scale-110' : 'scale-100')
      }
    >
      <div
        className={
          'absolute inset-0 rounded-full bg-rarity-legendary/30 blur-2xl ' +
          (pulse ? 'animate-pulse' : '')
        }
      />
      <span className="relative">{opening ? '✨📦✨' : '📦'}</span>
    </div>
  )
}

const RARITY_BORDER: Record<'common' | 'rare' | 'epic', string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-legendary shadow-[0_0_24px_rgba(255,200,60,0.55)]',
}

function Card({
  rarity,
  revealed,
  name,
  emoji,
}: {
  rarity: 'common' | 'rare' | 'epic'
  revealed: boolean
  name: string
  emoji: string
}) {
  return (
    <div className="[perspective:600px]" style={{ aspectRatio: '3 / 4' }}>
      <div
        className={
          'relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ' +
          (revealed ? '[transform:rotateY(0deg)]' : '[transform:rotateY(180deg)]')
        }
      >
        {/* Front (face) */}
        <div
          className={
            'absolute inset-0 [backface-visibility:hidden] bg-bg-secondary border-2 rounded-card flex flex-col items-center justify-center gap-2 ' +
            RARITY_BORDER[rarity] +
            (rarity === 'epic' && revealed ? ' animate-pulse' : '')
          }
        >
          <div className="text-4xl">{emoji}</div>
          <div className="font-display font-bold text-xs uppercase tracking-wider text-text-primary text-center px-1">
            {name}
          </div>
          <div
            className={
              'font-mono text-[9px] uppercase tracking-widest ' +
              (rarity === 'epic'
                ? 'text-rarity-legendary'
                : rarity === 'rare'
                  ? 'text-rarity-rare'
                  : 'text-rarity-common')
            }
          >
            {rarity}
          </div>
        </div>
        {/* Back (hidden side, shown while flipped) */}
        <div
          className="absolute inset-0 [backface-visibility:hidden] bg-bg-tertiary border-2 border-white/15 rounded-card flex items-center justify-center [transform:rotateY(180deg)]"
        >
          <div className="font-display font-black text-4xl text-accent-primary opacity-50">?</div>
        </div>
      </div>
    </div>
  )
}
