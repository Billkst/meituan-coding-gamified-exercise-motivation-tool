// Card collection — 12-card grid; locked cards show unlock CTA, unlocked show level + upgrade CTA.

import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconCoins } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClashState } from '@/clash/api/clashState'
import { useUnlockCard, useUpgradeCard } from '@/clash/api/clashCards'
import { CR_CARDS, nextUpgradeCost } from '@/clash/lib/cardData'
import type { ClashCardWithUser } from '@/clash/lib/types'
import { useState } from 'react'

const RARITY_BORDER: Record<string, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

export default function ClashCards() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useClashState()
  const unlock = useUnlockCard()
  const upgrade = useUpgradeCard()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-xs animate-pulse">loading…</div>
  }
  if (!data) return null

  const byId = new Map(data.cards.map((c) => [c.id, c]))

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8">
      <header className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/clash')} className="text-text-tertiary hover:text-text-primary">
          <IconArrowLeft size={18} />
        </button>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight">
          {t('clash.cards.title' as never)}
        </h1>
        <div className="ml-auto inline-flex items-center gap-1.5 bg-bg-secondary border border-white/10 rounded-card px-3 py-1.5">
          <IconCoins size={14} className="text-rarity-legendary" />
          <span className="font-mono text-sm tabular-nums">{data.gold}</span>
        </div>
      </header>

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
    </div>
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
      )}
    </div>
  )
}
