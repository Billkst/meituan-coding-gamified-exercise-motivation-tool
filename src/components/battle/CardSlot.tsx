import { IconStarFilled, IconShield, IconX as IconXMark } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { BattleCard } from '@/lib/battle/types'
import type { Rarity } from '@/types/db'
import { ABILITY_ICON, ABILITY_LABEL_KEY, ABILITY_TINT } from '@/lib/battle/abilityIcons'
import { cardEmoji } from '@/lib/cardArt'

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
}

const RARITY_ART_BG: Record<Rarity, string> = {
  common: 'bg-rarity-common/10',
  rare: 'bg-rarity-rare/15',
  epic: 'bg-rarity-epic/15',
  legendary: 'bg-rarity-legendary/20',
}

const RARITY_ART_GLOW: Record<Rarity, string> = {
  common: '',
  rare: 'shadow-[inset_0_0_20px_rgba(60,140,255,0.3)]',
  epic: 'shadow-[inset_0_0_24px_rgba(156,60,255,0.4)]',
  legendary: 'shadow-[inset_0_0_32px_rgba(255,200,60,0.5)]',
}

interface Props {
  card: BattleCard
  selectable: boolean
  selected?: boolean
  recommended?: boolean
  damagePreview?: number | null
  striking?: 'up' | 'down' | null
  shaking?: boolean
  onClick?: () => void
  side: 'player' | 'opponent'
}

export default function CardSlot({
  card,
  selectable,
  selected,
  recommended,
  damagePreview,
  striking,
  shaking,
  onClick,
  side,
}: Props) {
  const { t, lang } = useTranslation()
  const c = card.card
  const AbilityIcon = c.ability_kind ? ABILITY_ICON[c.ability_kind] : null
  const abilityLabel = c.ability_kind ? t(ABILITY_LABEL_KEY[c.ability_kind]) : null
  const abilityTint = c.ability_kind ? ABILITY_TINT[c.ability_kind] : 'text-text-tertiary'
  const emoji = cardEmoji(c)

  const totalShield = card.active_buffs
    .filter((b) => b.kind === 'shield' || b.kind === 'defense_buff')
    .reduce((sum, b) => sum + b.value, 0)

  const isDead = !card.is_alive
  const isPlayed = card.is_played

  const animClass = striking === 'up'
    ? 'animate-strike-up'
    : striking === 'down'
    ? 'animate-strike-down'
    : shaking
    ? 'animate-shake-hit'
    : ''

  const baseTitle = lang === 'zh' ? c.ability_text_zh : c.ability_text_en
  const tooltip = baseTitle ?? abilityLabel ?? undefined

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable || isPlayed || isDead}
      title={tooltip}
      className={
        'relative aspect-[3/4] rounded-card flex flex-col overflow-hidden border-2 ' +
        RARITY_BORDER[c.rarity] + ' bg-bg-secondary ' +
        (isPlayed || isDead ? 'opacity-40 grayscale ' : '') +
        (selectable && !isPlayed && !isDead
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-glow-standard transition-all duration-200 '
          : 'cursor-default ') +
        (selected ? 'ring-2 ring-accent-primary -translate-y-2 shadow-glow-hero ' : '') +
        (recommended && !selected
          ? 'ring-2 ring-rarity-legendary shadow-glow-legendary animate-halo-pulse '
          : '') +
        animClass + ' '
      }
    >
      {/* art region — emoji + rarity glow */}
      <div className={'h-12 flex items-center justify-center text-2xl ' + RARITY_ART_BG[c.rarity] + ' ' + RARITY_ART_GLOW[c.rarity]}>
        <span className="select-none" aria-hidden>
          {emoji}
        </span>
      </div>

      {/* body */}
      <div className="flex-1 px-1.5 pt-1.5 pb-3 flex flex-col">
        <div className="font-display text-[11px] font-bold leading-tight text-center text-text-primary line-clamp-2 mb-1">
          {lang === 'zh' ? c.name_zh : c.name_en}
        </div>
        {AbilityIcon && abilityLabel && (
          <div className={'flex items-center justify-center gap-0.5 font-mono text-[8px] uppercase tracking-tight ' + abilityTint}>
            <AbilityIcon size={9} />
            <span className="truncate">{abilityLabel}</span>
          </div>
        )}
      </div>

      {/* ATK chip — bottom-left */}
      <div className="absolute bottom-1 left-1 w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-700 border border-orange-300 flex items-center justify-center font-display font-black text-[12px] text-white tabular-nums shadow-md">
        {c.base_attack}
      </div>

      {/* DEF chip — bottom-right */}
      <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 border border-cyan-300 flex items-center justify-center font-display font-black text-[12px] text-white tabular-nums shadow-md">
        {c.base_defense}
      </div>

      {/* star count — top-left over art */}
      {card.star_level > 0 && (
        <div className="absolute top-1 left-1 flex items-center gap-0.5">
          {Array.from({ length: card.star_level }).map((_, i) => (
            <IconStarFilled key={i} size={7} className="text-rarity-legendary" />
          ))}
        </div>
      )}

      {/* card id (very small, top-right over art) */}
      <div className="absolute top-1 right-1 font-mono text-[7px] text-text-tertiary/60 uppercase tracking-tight max-w-[40%] truncate">
        {c.id}
      </div>

      {/* shield buff badge — middle-right */}
      {totalShield > 0 && !isPlayed && !isDead && (
        <div className="absolute top-1/3 right-1 bg-rarity-rare/30 border border-rarity-rare rounded-full px-1.5 py-0.5 font-mono text-[8px] tabular-nums text-rarity-rare flex items-center gap-0.5 shadow-glow-subtle">
          <IconShield size={8} />
          +{totalShield}
        </div>
      )}

      {/* damage preview — over enemy card during pick_target */}
      {side === 'opponent' && damagePreview != null && !isPlayed && !isDead && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-semantic-error/85 border border-red-300 rounded-full px-2 py-0.5 font-display font-bold text-[12px] tabular-nums text-white shadow-glow-subtle pointer-events-none">
          -{damagePreview}
        </div>
      )}

      {/* dead overlay */}
      {isDead && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <IconXMark size={36} className="text-semantic-error/80" strokeWidth={3} />
        </div>
      )}

      {/* played-not-dead overlay */}
      {!isDead && isPlayed && (
        <div className="absolute inset-x-0 top-1/2 font-mono text-[9px] uppercase tracking-widest text-text-tertiary text-center bg-black/50 py-0.5">
          {side === 'player' ? 'PLAYED' : 'PLAYED'}
        </div>
      )}
    </button>
  )
}
