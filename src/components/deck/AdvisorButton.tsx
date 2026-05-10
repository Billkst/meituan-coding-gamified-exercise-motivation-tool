import { useState } from 'react'
import { IconBolt, IconX } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { recommendDeck } from '@/lib/battle/advisor'
import type { OwnedCard } from '@/api/cards'

interface Props {
  ownedCards: OwnedCard[]
  onAccept(deckIds: string[]): void
}

export default function AdvisorButton({ ownedCards, onAccept }: Props) {
  const { t, lang } = useTranslation()
  const [open, setOpen] = useState(false)

  if (ownedCards.length < 8) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 bg-accent-primary text-bg-primary font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-button shadow-glow-subtle hover:shadow-glow-standard"
      >
        <IconBolt size={12} />
        {t('deck.advisor')}
      </button>
      {open && (
        <AdvisorModal
          ownedCards={ownedCards}
          lang={lang}
          onClose={() => setOpen(false)}
          onAccept={(ids) => { onAccept(ids); setOpen(false) }}
        />
      )}
    </>
  )
}

function AdvisorModal({ ownedCards, lang, onClose, onAccept }: {
  ownedCards: OwnedCard[]
  lang: 'zh' | 'en'
  onClose(): void
  onAccept(ids: string[]): void
}) {
  const { t } = useTranslation()
  const r = recommendDeck(ownedCards)
  const reasoning = lang === 'zh' ? r.reasoning_zh : r.reasoning_en
  const cards = r.deck
    .map(id => ownedCards.find(o => o.card_id === id))
    .filter((c): c is OwnedCard => !!c)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-8">
      <div className="bg-bg-secondary rounded-card p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            {t('deck.advisor_modal.title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-primary">
            <IconX size={18} />
          </button>
        </div>
        <div className="font-mono text-xs text-text-secondary uppercase tracking-widest mb-4">
          {t('deck.advisor_modal.reasoning', { r: reasoning })}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {cards.map(c => (
            <div key={c.card_id} className="bg-bg-primary rounded p-2 text-xs">
              <div className="font-bold">
                {lang === 'zh' ? c.card.name_zh : c.card.name_en}
              </div>
              <div className="font-mono text-[9px] tabular-nums text-text-tertiary">
                ★{c.star_level} · {c.card.rarity}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-white/10 rounded-button"
          >
            {t('deck.advisor_modal.cancel')}
          </button>
          <button
            onClick={() => onAccept(r.deck)}
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 bg-accent-primary text-bg-primary rounded-button shadow-glow-subtle"
          >
            {t('deck.advisor_modal.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
