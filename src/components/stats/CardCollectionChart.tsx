import { useTranslation, type TranslationKey } from '@/lib/i18n'
import type { UserStats, Rarity } from '@/types/db'

interface Props {
  data: UserStats['card_collection']
}

const RARITY_TONE: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
}

const RARITY_DOT: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
}

export function CardCollectionChart({ data }: Props) {
  const { t } = useTranslation()

  return (
    <section className="bg-bg-secondary border border-white/10 rounded-card p-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
        {t('stats.card_collection.title')}
      </h2>
      <div className="space-y-3">
        {data.map((row) => {
          const widthPct = row.total > 0 ? (row.owned / row.total) * 100 : 0
          const labelKey = `stats.rarity.${row.rarity}` as TranslationKey

          return (
            <div key={row.rarity} className="flex items-center gap-3">
              <span className={'w-2.5 h-2.5 rounded-full flex-shrink-0 ' + RARITY_DOT[row.rarity]} />
              <div className="w-20 font-body text-sm text-text-primary">{t(labelKey)}</div>
              <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={'h-full transition-all ' + RARITY_TONE[row.rarity]}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="font-mono text-[10px] text-text-tertiary tabular-nums w-20 text-right">
                {row.owned} / {row.total}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
