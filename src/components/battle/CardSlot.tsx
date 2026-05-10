import { IconStarFilled, IconShield } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { BattleCard } from '@/lib/battle/types'
import type { Rarity } from '@/types/db'
import { ABILITY_ICON, ABILITY_LABEL_KEY, ABILITY_TINT } from '@/lib/battle/abilityIcons'

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

interface Props {
  card: BattleCard
  selectable: boolean
  selected?: boolean
  recommended?: boolean
  damagePreview?: number | null
  onClick?: () => void
  side: 'player' | 'opponent'
}

export default function CardSlot({
  card,
  selectable,
  selected,
  recommended,
  damagePreview,
  onClick,
  side,
}: Props) {
  const { t, lang } = useTranslation()
  const c = card.card
  const AbilityIcon = c.ability_kind ? ABILITY_ICON[c.ability_kind] : null
  const abilityLabel = c.ability_kind ? t(ABILITY_LABEL_KEY[c.ability_kind]) : null
  const abilityTint = c.ability_kind ? ABILITY_TINT[c.ability_kind] : 'text-text-tertiary'

  const totalShield = card.active_buffs
    .filter((b) => b.kind === 'shield' || b.kind === 'defense_buff')
    .reduce((sum, b) => sum + b.value, 0)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable || card.is_played}
      title={c.ability_kind && (lang === 'zh' ? c.ability_text_zh : c.ability_text_en) || abilityLabel || undefined}
      className={
        'relative aspect-[3/4] bg-bg-secondary rounded-card p-2 flex flex-col gap-1 border ' +
        RARITY_BORDER[c.rarity] + ' ' +
        (card.is_played ? 'opacity-30 grayscale ' : '') +
        (selectable ? 'cursor-pointer hover:scale-[1.04] transition-transform ' : 'cursor-default ') +
        (selected ? 'ring-2 ring-accent-primary shadow-glow-standard ' : '') +
        (recommended && !selected ? 'ring-2 ring-rarity-legendary shadow-glow-subtle animate-halo-pulse ' : '')
      }
    >
      {/* top row: id (left) / star (right) */}
      <div className="flex justify-between items-start font-mono text-[8px] text-text-tertiary uppercase tracking-widest">
        <span className="truncate max-w-[60%]">{c.id}</span>
        <span className="flex items-center gap-0.5">
          {Array.from({ length: card.star_level }).map((_, i) => (
            <IconStarFilled key={i} size={8} className="text-rarity-legendary" />
          ))}
        </span>
      </div>

      {/* name */}
      <div className="flex-1 flex items-center justify-center text-center px-1">
        <span className="font-display text-xs font-bold leading-tight">
          {lang === 'zh' ? c.name_zh : c.name_en}
        </span>
      </div>

      {/* ability row */}
      {AbilityIcon && abilityLabel && (
        <div className={'flex items-center justify-center gap-1 font-mono text-[8px] uppercase tracking-widest ' + abilityTint}>
          <AbilityIcon size={10} />
          <span className="truncate">{abilityLabel}</span>
        </div>
      )}

      {/* atk/def row */}
      <div className="font-mono text-[9px] tabular-nums flex justify-between text-text-secondary">
        <span>ATK {c.base_attack}</span>
        <span>DEF {c.base_defense}</span>
      </div>

      {/* active buffs corner badge (shield/defense_buff) */}
      {totalShield > 0 && !card.is_played && (
        <div className="absolute top-1 right-1 bg-rarity-rare/20 border border-rarity-rare rounded-full px-1.5 py-0.5 font-mono text-[8px] tabular-nums text-rarity-rare flex items-center gap-0.5 shadow-glow-subtle">
          <IconShield size={8} />
          +{totalShield}
        </div>
      )}

      {/* damage preview badge — only on enemy side, only when caller passes a value */}
      {side === 'opponent' && damagePreview != null && !card.is_played && (
        <div className="absolute -top-2 -right-2 bg-semantic-error/20 border border-semantic-error rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums text-semantic-error font-bold shadow-glow-subtle">
          {t('battle.preview.expected', { dmg: damagePreview })}
        </div>
      )}

      {side === 'player' && card.is_played && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-text-tertiary">
          PLAYED
        </div>
      )}
    </button>
  )
}
