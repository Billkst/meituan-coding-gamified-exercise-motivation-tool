// ClashCollection — merged cards library + deck builder behind URL ?tab=cards|deck.
// Replaces standalone ClashCards.tsx and ClashDeck.tsx (Day 21).

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconArrowLeft, IconCoins, IconCheck } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClashState } from '@/clash/api/clashState'
import { useUnlockCard, useUpgradeCard } from '@/clash/api/clashCards'
import { useSetDeck } from '@/clash/api/clashDeck'
import { CR_CARDS, CR_CARDS_BY_ID, nextUpgradeCost } from '@/clash/lib/cardData'
import type { CrCardId } from '@/clash/lib/cardData'
import type { ClashCardWithUser } from '@/clash/lib/types'

const RARITY_BORDER: Record<string, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

type TabKey = 'cards' | 'deck'

export default function ClashCollection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useClashState()

  const tab: TabKey = params.get('tab') === 'deck' ? 'deck' : 'cards'
  const switchTab = (next: TabKey) => {
    const np = new URLSearchParams(params)
    np.set('tab', next)
    setParams(np, { replace: true })
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-xs animate-pulse">loading…</div>
  }
  if (!data) return null

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 pl-14 md:pl-8 py-8">
      <header className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/clash')} className="text-text-tertiary hover:text-text-primary">
          <IconArrowLeft size={18} />
        </button>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight">
          {t('clash.collection.title' as never)}
        </h1>
        <div className="ml-auto inline-flex items-center gap-1.5 bg-bg-secondary border border-white/10 rounded-card px-3 py-1.5">
          <IconCoins size={14} className="text-rarity-legendary" />
          <span className="font-mono text-sm tabular-nums">{data.gold}</span>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-white/10 mb-6">
        <TabButton active={tab === 'deck'} onClick={() => switchTab('deck')} label={t('clash.collection.tab.deck' as never)} />
        <TabButton active={tab === 'cards'} onClick={() => switchTab('cards')} label={t('clash.collection.tab.cards' as never)} />
      </div>

      {tab === 'cards' ? <CardsView /> : <DeckView />}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'font-display font-bold uppercase tracking-wider text-sm pb-3 transition-colors duration-150 ' +
        (active
          ? 'text-accent-primary border-b-2 border-accent-primary'
          : 'text-text-tertiary hover:text-text-secondary')
      }
    >
      {label}
    </button>
  )
}

// =============================================================================
// Cards view (was ClashCards.tsx)
// =============================================================================

function CardsView() {
  const { t, lang } = useTranslation()
  const { data } = useClashState()
  const unlock = useUnlockCard()
  const upgrade = useUpgradeCard()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  if (!data) return null

  const byId = new Map(data.cards.map((c) => [c.id, c]))

  return (
    <>
      {error && (
        <div className="mb-4 bg-semantic-error/10 border border-semantic-error/40 rounded-card px-3 py-2 font-mono text-xs text-semantic-error">
          {error}
        </div>
      )}

      {flash && (
        <div className="fixed top-6 right-6 bg-accent-primary text-bg-primary font-display font-bold uppercase px-4 py-3 rounded-card shadow-glow-standard z-50 animate-pulse">
          {flash}
        </div>
      )}

      {/* 1-line currency model hint — pre-empts the "I got 3💎 from workout
          but the card is still locked at 10💰" confusion the QA report flagged. */}
      <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-4 text-center">
        {t('clash.cards.currency_hint' as never)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {CR_CARDS.map((cardDef) => {
          const userCard = byId.get(cardDef.id)
          if (!userCard) return null
          return (
            <CardTile
              key={cardDef.id}
              card={userCard}
              gold={data.gold}
              lang={lang}
              onUnlock={() => {
                setError(null)
                unlock.mutate(cardDef.id, {
                  onSuccess: () => {
                    setFlash(`🔓 ${cardDef.name_zh} 解锁成功`)
                    window.setTimeout(() => setFlash(null), 2000)
                  },
                  onError: (e) => setError(e instanceof Error ? e.message : String(e)),
                })
              }}
              onUpgrade={() => {
                setError(null)
                upgrade.mutate(cardDef.id, {
                  onSuccess: (r) => {
                    setFlash(`⬆️ ${cardDef.name_zh} 升至 Lv ${r.level}`)
                    window.setTimeout(() => setFlash(null), 2000)
                  },
                  onError: (e) => setError(e instanceof Error ? e.message : String(e)),
                })
              }}
              busy={unlock.isPending || upgrade.isPending}
            />
          )
        })}
      </div>
    </>
  )
}

function CardTile({
  card,
  gold,
  lang,
  onUnlock,
  onUpgrade,
  busy,
}: {
  card: ClashCardWithUser
  gold: number
  lang: 'zh' | 'en'
  onUnlock: () => void
  onUpgrade: () => void
  busy: boolean
}) {
  const { t } = useTranslation()
  const cost = nextUpgradeCost(card.level)
  const canUpgrade = cost && card.shards >= cost.shards && gold >= cost.gold
  const canUnlock = !card.unlocked && gold >= card.unlock_cost && card.unlock_cost > 0

  return (
    <div
      className={
        'bg-bg-secondary rounded-card p-3 border-2 ' +
        (card.unlocked ? RARITY_BORDER[card.rarity] : 'border-white/10 opacity-70')
      }
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-3xl">{card.emoji}</span>
        <span className="font-display font-bold text-xs bg-rarity-epic text-bg-primary rounded-full w-6 h-6 flex items-center justify-center">
          {card.cost}
        </span>
      </div>
      <div className="font-display font-bold text-sm uppercase tracking-tight mb-1">
        {lang === 'zh' ? card.name_zh : card.name_en}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary mb-2">
        {t(`clash.cards.types.${card.card_type}` as never)} · {card.rarity}
      </div>
      {card.unlocked ? (
        <>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-1">
            {t('clash.cards.level' as never, { n: card.level })}
          </div>
          <div className="font-mono text-[10px] text-text-tertiary mb-3">
            💎 {card.shards}
          </div>
          {card.level >= 11 ? (
            <div className="font-mono text-[10px] uppercase tracking-widest text-rarity-legendary text-center py-1.5">
              {t('clash.cards.max_level' as never)}
            </div>
          ) : (
            <button
              onClick={onUpgrade}
              disabled={!canUpgrade || busy}
              className={
                'w-full font-mono uppercase text-[10px] tracking-widest py-1.5 rounded-button border ' +
                (canUpgrade
                  ? 'bg-accent-primary text-bg-primary border-accent-primary hover:scale-[1.02]'
                  : 'border-white/10 text-text-tertiary cursor-not-allowed')
              }
            >
              {t('clash.cards.upgrade_cta' as never)}{' '}
              <span className="opacity-70">
                {cost ? `· ${cost.gold}💰 ${cost.shards}💎` : ''}
              </span>
            </button>
          )}
        </>
      ) : (
        <>
          {/* Show accumulated shards even when locked so workout chest drops
              ("+3 💎 小皮卡") have a visible home. Without this the user feels
              the chest reward vanished. */}
          {card.shards > 0 && (
            <div className="font-mono text-[10px] text-text-tertiary mb-2">
              💎 {card.shards}
            </div>
          )}
          <button
            onClick={onUnlock}
            disabled={!canUnlock || busy}
            className={
              'w-full font-mono uppercase text-[10px] tracking-widest py-1.5 rounded-button border ' +
              (canUnlock
                ? 'bg-accent-primary text-bg-primary border-accent-primary hover:scale-[1.02]'
                : 'border-white/10 text-text-tertiary cursor-not-allowed')
            }
          >
            {t('clash.cards.unlock_cta' as never)} · {card.unlock_cost}💰
          </button>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Deck view (was ClashDeck.tsx)
// =============================================================================

function DeckView() {
  const { t, lang } = useTranslation()
  const { data } = useClashState()
  const setDeck = useSetDeck()
  const [draftDeck, setDraftDeck] = useState<CrCardId[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (data && draftDeck.length === 0 && data.deck.length === 8) {
    setDraftDeck(data.deck)
  }
  if (!data) return null

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
    <>
      {savedFlash && (
        <div className="fixed top-6 right-6 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/40 rounded-card px-3 py-2 z-50">
          <IconCheck size={12} /> saved
        </div>
      )}

      {error && (
        <div className="mb-4 bg-semantic-error/10 border border-semantic-error/40 rounded-card px-3 py-2 font-mono text-xs text-semantic-error">
          {error}
        </div>
      )}

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
    </>
  )
}
