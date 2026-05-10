import { IconStar, IconStarFilled, IconArrowUpRight } from '@tabler/icons-react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import {
  useMyCards,
  useAllCards,
  useUpgradeCard,
  nextStarCost,
  type OwnedCard,
} from '@/api/cards'
import type { Rarity } from '@/types/db'

const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common']

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

const RARITY_BG_FILL: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
}

export default function CardLibrary() {
  const { t, lang } = useTranslation()
  const { data: myCards = [], isLoading } = useMyCards()
  const { data: allCards = [] } = useAllCards()
  const upgrade = useUpgradeCard()

  const totalPool = allCards.length
  const ownedCount = myCards.length

  // Pool size per rarity (for "X / N" labels)
  const poolByRarity: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
  for (const c of allCards) poolByRarity[c.rarity] += 1

  // Owned per rarity
  const ownedByRarity: Record<Rarity, OwnedCard[]> = { common: [], rare: [], epic: [], legendary: [] }
  for (const oc of myCards) {
    if (oc.card) ownedByRarity[oc.card.rarity].push(oc)
  }

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('library.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t('library.title_n', { n: ownedCount, total: totalPool })}
      </h1>

      {/* Progress banner */}
      <section className="bg-bg-secondary border border-white/10 rounded-card p-6 mb-8">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-display text-4xl font-black tabular-nums">{ownedCount}</span>
          <span className="font-mono text-sm text-text-tertiary uppercase tracking-widest">
            / {totalPool} {t('library.cards_unit')}
          </span>
        </div>
        <div className="space-y-2">
          {RARITY_ORDER.map((r) => {
            const have = ownedByRarity[r].length
            const pool = poolByRarity[r]
            const pct = pool > 0 ? (have / pool) * 100 : 0
            return (
              <div key={r} className="flex items-center gap-3">
                <span className={'font-mono text-[10px] uppercase tracking-widest w-20 ' + RARITY_TEXT[r]}>
                  {r}
                </span>
                <div className="flex-1 h-2 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className={'h-full ' + RARITY_BG_FILL[r]}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-text-tertiary tabular-nums w-16 text-right">
                  {have} / {pool}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 4 sections */}
      {isLoading ? (
        <div className="font-mono text-sm text-text-tertiary uppercase tracking-widest py-12 text-center">
          {t('library.loading')}
        </div>
      ) : (
        <div className="space-y-10">
          {RARITY_ORDER.map((r) => {
            const cards = ownedByRarity[r]
            return (
              <section key={r}>
                <div className="flex items-baseline gap-3 mb-4">
                  <span className={'font-mono text-xs uppercase tracking-widest ' + RARITY_TEXT[r]}>
                    {r}
                  </span>
                  <span className="font-mono text-[10px] text-text-tertiary tabular-nums">
                    {cards.length} / {poolByRarity[r]}
                  </span>
                </div>
                {cards.length === 0 ? (
                  <div className="bg-bg-secondary border border-dashed border-white/10 rounded-card px-6 py-8 text-center">
                    <span className="font-mono text-xs text-text-tertiary uppercase tracking-widest">
                      {t('library.locked')}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map((oc) => (
                      <CardTile
                        key={oc.card_id}
                        owned={oc}
                        lang={lang}
                        t={t}
                        onUpgrade={() => upgrade.mutate(oc.card_id)}
                        upgrading={upgrade.isPending && upgrade.variables === oc.card_id}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface CardTileProps {
  owned: OwnedCard
  lang: 'zh' | 'en'
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  onUpgrade: () => void
  upgrading: boolean
}

function CardTile({ owned, lang, t, onUpgrade, upgrading }: CardTileProps) {
  const c = owned.card
  if (!c) return null

  const cost = nextStarCost(owned.star_level)
  const canUpgrade = cost !== null && owned.copies >= cost

  return (
    <article
      className={
        'bg-bg-secondary rounded-card p-4 flex flex-col gap-3 border-l-2 ' +
        RARITY_BORDER[c.rarity]
      }
    >
      {/* header: rarity + id */}
      <div className="flex items-center justify-between">
        <span
          className={
            'font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ' +
            RARITY_BORDER[c.rarity] + ' ' + RARITY_TEXT[c.rarity]
          }
        >
          {c.rarity}
        </span>
        <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">
          {c.id}
        </span>
      </div>

      {/* name */}
      <div className="font-display font-bold text-xl text-text-primary">
        {lang === 'zh' ? c.name_zh : c.name_en}
      </div>

      {/* ability text */}
      <div className="font-body text-xs text-text-secondary leading-relaxed min-h-[36px]">
        {lang === 'zh' ? c.ability_text_zh : c.ability_text_en}
      </div>

      {/* stars + atk/def + copies */}
      <div className="flex items-center justify-between text-text-tertiary">
        <StarRow star={owned.star_level} />
        <span className="font-mono text-[11px] tabular-nums">
          ATK {c.base_attack} · DEF {c.base_defense}
        </span>
      </div>

      {/* upgrade row */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="font-mono text-[11px] text-text-secondary tabular-nums">
          ×{owned.copies}
        </span>
        {cost === null ? (
          <span className="font-mono text-[10px] text-rarity-legendary uppercase tracking-widest">
            {t('library.maxed')}
          </span>
        ) : canUpgrade ? (
          <button
            onClick={onUpgrade}
            disabled={upgrading}
            className="inline-flex items-center gap-1 bg-accent-primary text-bg-primary font-mono text-[11px] uppercase tracking-widest px-3 py-1 rounded-button shadow-glow-subtle hover:shadow-glow-standard transition-all duration-150 ease-enter disabled:opacity-50"
          >
            {upgrading ? t('library.upgrading') : t('library.upgrade', { cost })}
            <IconArrowUpRight size={12} />
          </button>
        ) : (
          <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">
            {t('library.need', { cost: cost - owned.copies })}
          </span>
        )}
      </div>
    </article>
  )
}

function StarRow({ star }: { star: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) =>
        i <= star ? (
          <IconStarFilled key={i} size={12} className="text-rarity-legendary" />
        ) : (
          <IconStar key={i} size={12} className="text-text-tertiary" />
        )
      )}
    </div>
  )
}
