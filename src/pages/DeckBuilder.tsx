import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useMyCards } from '@/api/cards'
import { useActiveDeck, useSaveDeck } from '@/api/deck'
import DeckSlots from '@/components/deck/DeckSlots'
import CardPicker from '@/components/deck/CardPicker'
import AdvisorButton from '@/components/deck/AdvisorButton'
import type { OwnedCard } from '@/api/cards'

export default function DeckBuilder() {
  const { t } = useTranslation()
  const { data: myCards = [] } = useMyCards()
  const { data: activeDeck } = useActiveDeck()
  const saveMutation = useSaveDeck()
  const [slotIds, setSlotIds] = useState<(string | null)[]>(Array(8).fill(null))
  const [savedToast, setSavedToast] = useState(false)

  // Initialize slots from active deck on first load
  useEffect(() => {
    if (activeDeck?.card_ids && activeDeck.card_ids.length > 0) {
      const padded: (string | null)[] = []
      for (let i = 0; i < 8; i++) {
        padded.push(activeDeck.card_ids[i] ?? null)
      }
      setSlotIds(padded)
    }
  }, [activeDeck])

  const ownedById = useMemo(() => {
    const m = new Map<string, OwnedCard>()
    for (const c of myCards) m.set(c.card_id, c)
    return m
  }, [myCards])

  const slotCards = slotIds.map(id => id ? ownedById.get(id) ?? null : null)
  const filledCount = slotIds.filter(Boolean).length
  const selectedIds = slotIds.filter((id): id is string => !!id)

  function pick(cardId: string) {
    if (selectedIds.includes(cardId)) return
    const idx = slotIds.findIndex(s => s === null)
    if (idx === -1) return
    const next = [...slotIds]
    next[idx] = cardId
    setSlotIds(next)
  }

  function remove(slotIdx: number) {
    const next = [...slotIds]
    next[slotIdx] = null
    setSlotIds(next)
  }

  function applyAdvisor(ids: string[]) {
    const next = Array<string | null>(8).fill(null)
    ids.slice(0, 8).forEach((id, i) => { next[i] = id })
    setSlotIds(next)
  }

  function save() {
    if (filledCount !== 8) return
    saveMutation.mutate(selectedIds, {
      onSuccess: () => {
        setSavedToast(true)
        setTimeout(() => setSavedToast(false), 1500)
      },
    })
  }

  return (
    <div className="max-w-container mx-auto px-8 py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('deck.section')}
      </div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-bold text-3xl uppercase tracking-tight">
          {t('deck.title_n', { n: filledCount })}
        </h1>
        <div className="flex items-center gap-3">
          <AdvisorButton ownedCards={myCards} onAccept={applyAdvisor} />
          <button
            type="button"
            onClick={save}
            disabled={filledCount !== 8 || saveMutation.isPending}
            className={
              'font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-button transition-all ' +
              (filledCount === 8
                ? 'bg-accent-primary text-bg-primary shadow-glow-standard hover:shadow-glow-hero'
                : 'bg-bg-secondary text-text-tertiary cursor-not-allowed')
            }
          >
            {filledCount === 8 ? t('deck.save') : t('deck.save_disabled')}
          </button>
        </div>
      </div>

      {savedToast && (
        <div className="mb-4 bg-accent-primary/20 border-l-2 border-accent-primary px-4 py-2 font-mono text-xs uppercase tracking-widest">
          {t('deck.saved_toast')}
        </div>
      )}

      <section className="mb-10">
        <DeckSlots slots={slotCards} onRemove={remove} />
      </section>

      <section>
        <CardPicker ownedCards={myCards} selectedIds={selectedIds} onPick={pick} />
      </section>
    </div>
  )
}
