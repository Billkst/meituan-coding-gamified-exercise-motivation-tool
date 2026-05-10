import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useAllCards, useMyCards } from '@/api/cards'
import { useActiveDeck } from '@/api/deck'
import type { Card } from '@/types/db'

interface Props {
  npcDeckIds: string[]
}

const RARITY_TEXT: Record<Card['rarity'], string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
}

// Sum of base_attack/defense, ignoring star buffs (NPC cards default to 1★).
// For the player side we factor in star_level so the comparison reflects
// what they'd actually field.
function sumDeck(cards: Card[]): { atk: number; def: number } {
  let atk = 0, def = 0
  for (const c of cards) {
    atk += c.base_attack
    def += c.base_defense
  }
  return { atk, def }
}

export default function NpcDeckPreview({ npcDeckIds }: Props) {
  const { t, lang } = useTranslation()
  const { data: allCards = [] } = useAllCards()
  const { data: myCards = [] } = useMyCards()
  const { data: myDeck } = useActiveDeck()

  const cardsById = useMemo(() => {
    const m = new Map<string, Card>()
    for (const c of allCards) m.set(c.id, c)
    return m
  }, [allCards])

  const npcDeck = npcDeckIds.map((id) => cardsById.get(id)).filter((c): c is Card => !!c)
  const npcSum = sumDeck(npcDeck)

  // Player's deck (ATK/DEF including star bonuses).
  const myStarById = new Map<string, number>()
  for (const oc of myCards) myStarById.set(oc.card_id, oc.star_level)
  let mineAtk = 0, mineDef = 0
  if (myDeck && myDeck.card_ids.length === 8) {
    for (const id of myDeck.card_ids) {
      const c = cardsById.get(id)
      if (!c) continue
      const star = myStarById.get(id) ?? 1
      const mult = 1 + 0.2 * (star - 1)
      mineAtk += c.base_attack * mult
      mineDef += c.base_defense * mult
    }
    mineAtk = Math.round(mineAtk)
    mineDef = Math.round(mineDef)
  }

  const ownTotal = mineAtk + mineDef
  const npcTotal = npcSum.atk + npcSum.def
  const diffPct = npcTotal === 0 ? 0 : ((ownTotal - npcTotal) / npcTotal) * 100

  let advantageKey: 'arena.npc.advantage_yours' | 'arena.npc.advantage_even' | 'arena.npc.advantage_theirs'
  let advantageClass: string
  if (diffPct > 8) {
    advantageKey = 'arena.npc.advantage_yours'
    advantageClass = 'text-rarity-legendary'
  } else if (diffPct < -8) {
    advantageKey = 'arena.npc.advantage_theirs'
    advantageClass = 'text-semantic-error'
  } else {
    advantageKey = 'arena.npc.advantage_even'
    advantageClass = 'text-rarity-rare'
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
      {/* totals + advantage */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">
            {t('arena.npc.deck_atk')}
          </div>
          <div className="font-mono text-sm tabular-nums">
            {mineAtk} <span className="text-text-tertiary mx-1">vs</span> {npcSum.atk}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">
            {t('arena.npc.deck_def')}
          </div>
          <div className="font-mono text-sm tabular-nums">
            {mineDef} <span className="text-text-tertiary mx-1">vs</span> {npcSum.def}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">·</div>
          <div className={'font-mono text-[10px] uppercase tracking-widest ' + advantageClass}>
            {t(advantageKey)}
          </div>
        </div>
      </div>

      {/* NPC deck list */}
      <div className="grid grid-cols-2 gap-1.5">
        {npcDeck.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 px-2 py-1 bg-bg-primary/40 rounded border border-white/5"
          >
            <span className={'font-display text-[11px] truncate ' + RARITY_TEXT[c.rarity]}>
              {lang === 'zh' ? c.name_zh : c.name_en}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-text-tertiary flex-shrink-0">
              {c.base_attack}/{c.base_defense}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
