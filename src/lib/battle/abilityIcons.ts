import {
  IconSword,
  IconBolt,
  IconTarget,
  IconShield,
  IconArrowBackUp,
  IconHeart,
  IconGift,
  type Icon,
} from '@tabler/icons-react'
import type { AbilityKind } from '@/types/db'
import type { TranslationKey } from '@/lib/i18n'

export const ABILITY_ICON: Record<AbilityKind, Icon> = {
  damage_buff: IconSword,
  defense_buff: IconShield,
  first_strike: IconBolt,
  pierce: IconTarget,
  shield: IconShield,
  reflect: IconArrowBackUp,
  heal: IconHeart,
  xp_bonus: IconGift,
}

export const ABILITY_LABEL_KEY: Record<AbilityKind, TranslationKey> = {
  damage_buff: 'ability.damage_buff',
  defense_buff: 'ability.defense_buff',
  first_strike: 'ability.first_strike',
  pierce: 'ability.pierce',
  shield: 'ability.shield',
  reflect: 'ability.reflect',
  heal: 'ability.heal',
  xp_bonus: 'ability.xp_bonus',
}

// Visual tint per ability (ties into rarity color or accent palette)
export const ABILITY_TINT: Record<AbilityKind, string> = {
  damage_buff: 'text-rarity-legendary',
  defense_buff: 'text-rarity-rare',
  first_strike: 'text-rarity-legendary',
  pierce: 'text-rarity-epic',
  shield: 'text-rarity-rare',
  reflect: 'text-rarity-epic',
  heal: 'text-accent-primary',
  xp_bonus: 'text-rarity-legendary',
}
