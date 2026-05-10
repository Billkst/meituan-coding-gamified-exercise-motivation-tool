import type { Card } from '@/types/db'

// Lightweight "art" layer: map a card to a single emoji glyph + tint.
// Heuristics prefer English name keywords (consistent across DB) over
// Chinese, then fall back to rarity, then default. We pick this in pure
// JS so we don't have to migrate / regenerate the cards table.

const NAME_RULES: { match: RegExp; emoji: string }[] = [
  { match: /run|sprint|stride|dash|jog|marathon/i, emoji: '🏃' },
  { match: /cycle|bike|biking|spin|rider/i, emoji: '🚴' },
  { match: /swim|aqua|water|wave/i, emoji: '🏊' },
  { match: /yoga|stretch|flex|breathe|zen|balance|core/i, emoji: '🧘' },
  { match: /ball|hoop|dunk|kick|goal|striker|tackle/i, emoji: '⚽' },
  { match: /basket|dribble/i, emoji: '🏀' },
  { match: /strength|lift|press|squat|deadlift|barbell|iron|brawler/i, emoji: '🏋️' },
  { match: /punch|fight|martial|kick|guard|warrior|knight|berserk/i, emoji: '🥊' },
  { match: /climb|peak|mountain|summit/i, emoji: '🧗' },
  { match: /rock|stone|pebble|granite/i, emoji: '🪨' },
  { match: /shield|guard|defend|wall|fortress|bastion/i, emoji: '🛡️' },
  { match: /heal|medic|cleric|life|recovery|nurse|restore/i, emoji: '❤️‍🩹' },
  { match: /spirit|ghost|phantom|soul|wisp/i, emoji: '👻' },
  { match: /storm|thunder|lightning|bolt|spark/i, emoji: '⚡' },
  { match: /fire|flame|blaze|ember|burn/i, emoji: '🔥' },
  { match: /ice|frost|snow|cold|chill/i, emoji: '❄️' },
  { match: /forest|tree|leaf|nature|woods/i, emoji: '🌲' },
  { match: /sun|solar|dawn|noon|radiant/i, emoji: '☀️' },
  { match: /moon|night|dusk|shadow/i, emoji: '🌙' },
  { match: /heart|pulse|core|vital/i, emoji: '💗' },
  { match: /dragon|wyrm|drake/i, emoji: '🐉' },
  { match: /wolf|hound|fang/i, emoji: '🐺' },
  { match: /eagle|hawk|falcon|wing|sky/i, emoji: '🦅' },
  { match: /tiger|cat|lion/i, emoji: '🐯' },
  { match: /bear|ursine/i, emoji: '🐻' },
  { match: /fish|shark|whale/i, emoji: '🐟' },
]

const RARITY_FALLBACK: Record<Card['rarity'], string> = {
  legendary: '⚡',
  epic: '🔮',
  rare: '💎',
  common: '✨',
}

export function cardEmoji(card: Pick<Card, 'name_en' | 'name_zh' | 'rarity' | 'ability_kind'>): string {
  // Try ability_kind first (most semantic)
  if (card.ability_kind) {
    switch (card.ability_kind) {
      case 'shield':
      case 'defense_buff':
        return '🛡️'
      case 'heal':
        return '❤️‍🩹'
      case 'pierce':
        return '🎯'
      case 'first_strike':
        return '⚡'
      case 'reflect':
        return '🔄'
      case 'damage_buff':
        return '⚔️'
      case 'xp_bonus':
        return '🎁'
    }
  }
  // Then name keyword match (English first, Chinese second)
  const haystack = `${card.name_en ?? ''} ${card.name_zh ?? ''}`
  for (const rule of NAME_RULES) {
    if (rule.match.test(haystack)) return rule.emoji
  }
  return RARITY_FALLBACK[card.rarity]
}
