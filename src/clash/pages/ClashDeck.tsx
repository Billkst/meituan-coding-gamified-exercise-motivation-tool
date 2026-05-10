// Deck builder — current 8 + pool of unlocked cards. Tap pool card to swap into selected slot.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClashState } from '@/clash/api/clashState'
import { useSetDeck } from '@/clash/api/clashDeck'
import { CR_CARDS_BY_ID } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'

export default function ClashDeck() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useClashState()
  const setDeck = useSetDeck()
  const [draftDeck, setDraftDeck] = useState<CrCardId[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize draft from server deck on first load
  if (data && draftDeck.length === 0 && data.deck.length === 8) {
    setDraftDeck(data.deck)
  }

  if (isLoading || !data) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-xs animate-pulse">loading…</div>
  }

  const unlockedIds = data.cards.filter((c) => c.unlocked).map((c) => c.id)
  const draftSet = new Set(draftDeck)
  const dirty = draftDeck.length === 8 && draftDeck.some((id, i) => id !== data.deck[i])

  const handleSwapIn = (cardId: CrCardId) => {
    if (selectedSlot === null) return
    if (draftSet.has(cardId) && draftDeck[selectedSlot] !== cardId) return
    const next = [...draftDeck]
    next[selectedSlot] = cardId
    setDraftDeck(next)
    setSelectedSlot(null)
  }

  const handleSave = () => {
    setError(null)
    if (draftDeck.length !== 8) return
    setDeck.mutate(draftDeck, {
      onSuccess: () => {
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 2000)
      },
      onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    })
  }

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8">
      <header className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/clash')} className="text-text-tertiary hover:text-text-primary">
          <IconArrowLeft size={18} />
        </button>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight">
          {t('clash.deck.title' as never)}
        </h1>
        {savedFlash && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-accent-primary">
            <IconCheck size={12} /> saved
          </span>
        )}
      </header>

      {error && (
        <div className="mb-4 bg-semantic-error/10 border border-semantic-error/40 rounded-card px-3 py-2 font-mono text-xs text-semantic-error">
          {error}
        </div>
      )}

      {/* Current deck */}
      <section className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mb-3">
          {t('clash.deck.current' as never)} · 选中位置后从下方选卡替换
        </div>
        <div className="grid grid-cols-4 gap-2">
          {draftDeck.map((cardId, slot) => {
            const card = CR_CARDS_BY_ID[cardId]
            if (!card) return null
            const isSelected = selectedSlot === slot
            return (
              <button
                key={slot}
                onClick={() => setSelectedSlot(isSelected ? null : slot)}
                className={
                  'relative aspect-[3/4] rounded-card border-2 flex flex-col items-center justify-center transition-all ' +
                  (isSelected
                    ? 'border-accent-primary shadow-glow-standard scale-[1.05]'
                    : 'border-white/15 hover:border-white/40')
                }
              >
                <span className="text-3xl">{card.emoji}</span>
                <span className="font-display font-bold text-[10px] mt-1">
                  {lang === 'zh' ? card.name_zh : card.name_en}
                </span>
                <span className="absolute top-1 right-1 bg-rarity-epic text-bg-primary font-display font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {card.cost}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Pool */}
      <section className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mb-3">
          {t('clash.deck.pool' as never)}
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {unlockedIds.map((id) => {
            const card = CR_CARDS_BY_ID[id]
            if (!card) return null
            const inDeck = draftSet.has(id)
            const swappable = selectedSlot !== null && (!inDeck || draftDeck[selectedSlot] === id)
            return (
              <button
                key={id}
                onClick={() => handleSwapIn(id)}
                disabled={!swappable}
                className={
                  'aspect-[3/4] rounded-card border flex flex-col items-center justify-center text-center transition-all ' +
                  (swappable
                    ? 'border-accent-primary/60 bg-accent-primary/10 hover:scale-[1.05]'
                    : inDeck
                    ? 'border-white/10 opacity-30 cursor-not-allowed'
                    : 'border-white/10 opacity-60 cursor-not-allowed')
                }
              >
                <span className="text-2xl">{card.emoji}</span>
                <span className="font-display font-bold text-[10px] mt-1 px-1">
                  {lang === 'zh' ? card.name_zh : card.name_en}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex justify-center">
        <button
          onClick={handleSave}
          disabled={!dirty || setDeck.isPending}
          className={
            'font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button transition-all ' +
            (dirty
              ? 'bg-accent-primary text-bg-primary shadow-glow-standard hover:scale-[1.03]'
              : 'bg-bg-secondary border border-white/10 text-text-tertiary cursor-not-allowed')
          }
        >
          {t('clash.deck.save' as never)}
        </button>
      </div>
    </div>
  )
}
