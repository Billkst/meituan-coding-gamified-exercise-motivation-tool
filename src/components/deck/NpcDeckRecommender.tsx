import { useState } from 'react'
import { IconWand, IconCheck } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useNpcOpponents } from '@/api/npcs'
import { useRecommendDeck, reasoningFor } from '@/api/deckRecommend'

interface Props {
  ownedCardCount: number
  onApply(cardIds: string[]): void
}

export default function NpcDeckRecommender({ ownedCardCount, onApply }: Props) {
  const { t, lang } = useTranslation()
  const { data: npcs = [] } = useNpcOpponents()
  const recommend = useRecommendDeck()
  const [picked, setPicked] = useState<string>('')
  const [appliedToast, setAppliedToast] = useState(false)

  const canRecommend = ownedCardCount >= 8

  const onPickNpc = (npcId: string) => {
    setPicked(npcId)
    if (!npcId) return
    recommend.mutate(npcId)
  }

  const apply = () => {
    if (!recommend.data) return
    onApply(recommend.data.deck)
    setAppliedToast(true)
    setTimeout(() => setAppliedToast(false), 1500)
  }

  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <IconWand size={14} className="text-rarity-legendary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-rarity-legendary">
          {t('deck.recommend.title')}
        </span>
      </div>

      {!canRecommend && (
        <div className="font-mono text-xs text-text-tertiary italic">
          {t('deck.recommend.no_cards')}
        </div>
      )}

      {canRecommend && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={picked}
            onChange={(e) => onPickNpc(e.target.value)}
            disabled={recommend.isPending}
            className="bg-bg-primary border border-white/20 rounded px-2 py-1.5 font-mono text-xs disabled:opacity-50"
          >
            <option value="">{t('deck.recommend.placeholder')}</option>
            {npcs.filter((n) => n.is_unlocked).map((n) => (
              <option key={n.id} value={n.id}>
                L{n.level} · {lang === 'zh' ? n.name_zh : n.name_en}
              </option>
            ))}
          </select>

          {recommend.data && picked && (
            <>
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">
                {reasoningFor(recommend.data, lang)}
              </span>
              <button
                type="button"
                onClick={apply}
                className="ml-auto inline-flex items-center gap-1 bg-rarity-legendary/20 border border-rarity-legendary/50 text-rarity-legendary font-mono text-[10px] uppercase tracking-widest py-1.5 px-3 rounded-button hover:bg-rarity-legendary/30"
              >
                <IconCheck size={12} />
                {t('deck.recommend.apply')}
              </button>
            </>
          )}

          {recommend.isError && (
            <span className="font-mono text-[10px] text-semantic-error">
              {t('deck.recommend.error', { msg: (recommend.error as Error).message })}
            </span>
          )}
        </div>
      )}

      {appliedToast && (
        <div className="mt-2 font-mono text-[10px] text-accent-primary uppercase tracking-widest">
          ✓ {t('deck.recommend.applied')}
        </div>
      )}
    </div>
  )
}
