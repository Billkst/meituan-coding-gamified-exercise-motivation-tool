import type {
  BattleCard, BattleState, BattleLogEntry, Side, TriggerEvent, Buff,
} from '@/lib/battle/types'

function pickCards(side: Side, state: BattleState): BattleCard[] {
  return side === 'attacker' ? state.attacker_cards : state.defender_cards
}

function findCard(cards: BattleCard[], id: string): BattleCard {
  const c = cards.find(c => c.card.id === id)
  if (!c) throw new Error(`card not in side: ${id}`)
  return c
}

export function effectiveDefense(card: BattleCard, _state: BattleState, _side: Side): number {
  const base = card.card.base_defense * (1 + 0.2 * (card.star_level - 1))
  let bonus = 0
  for (const b of card.active_buffs) {
    if (b.kind === 'shield' || b.kind === 'defense_buff') bonus += b.value
  }
  return Math.round(base + bonus)
}

function effectiveAttack(card: BattleCard): number {
  return card.card.base_attack * (1 + 0.2 * (card.star_level - 1))
}

export function resolveAttack(
  state: BattleState,
  side: Side,
  atkId: string,
  defId: string,
): BattleState {
  const next: BattleState = JSON.parse(JSON.stringify(state))
  const atkSide = side
  const defSide: Side = side === 'attacker' ? 'defender' : 'attacker'

  const atk = findCard(pickCards(atkSide, next), atkId)
  const def = findCard(pickCards(defSide, next), defId)

  const triggers: TriggerEvent[] = []

  // 1. base damage from atk (fractional if star_level > 1)
  let dmg = effectiveAttack(atk)

  // 2. on_attack triggers: absolute additions first
  if (atk.card.ability_trigger === 'on_attack') {
    if (atk.card.ability_kind === 'damage_buff') {
      dmg += atk.card.ability_value
      triggers.push({ card_id: atk.card.id, kind: 'damage_buff', effect: `+${atk.card.ability_value}` })
    } else if (atk.card.ability_kind === 'first_strike' && next.turn <= 3) {
      dmg += atk.card.ability_value
      triggers.push({ card_id: atk.card.id, kind: 'first_strike', effect: `+${atk.card.ability_value} (turn ≤ 3)` })
    }
  }

  // 3. passive damage_buff (% multiplier) applied after absolute adds
  // Only apply if the buff is owned by the attacking side
  for (const buff of next.passive_buffs) {
    if (buff.kind === 'damage_buff' && isOwnedBy(buff, atkSide, next)) {
      dmg *= (1 + buff.value / 100)
      triggers.push({ card_id: buff.source_card_id, kind: 'damage_buff', effect: `passive +${buff.value}%` })
    }
  }

  const rawDamage = Math.round(dmg)

  // 4. apply DEF (skip if pierce)
  let actualDamage: number
  const isPierce = atk.card.ability_trigger === 'on_attack' && atk.card.ability_kind === 'pierce'
  if (isPierce) {
    actualDamage = rawDamage
    triggers.push({ card_id: atk.card.id, kind: 'pierce', effect: 'ignore DEF' })
  } else {
    const defVal = effectiveDefense(def, next, defSide)
    actualDamage = Math.max(1, rawDamage - defVal)
  }

  // 5. apply damage to defender side HP
  if (defSide === 'attacker') {
    next.attacker_hp -= actualDamage
  } else {
    next.defender_hp -= actualDamage
  }

  // 6. on_defend triggers (reflect)
  if (def.card.ability_trigger === 'on_defend' && def.card.ability_kind === 'reflect') {
    const reflectDmg = Math.round(actualDamage * def.card.ability_value / 100)
    if (atkSide === 'attacker') {
      next.attacker_hp -= reflectDmg
    } else {
      next.defender_hp -= reflectDmg
    }
    triggers.push({ card_id: def.card.id, kind: 'reflect', effect: `reflect ${def.card.ability_value}% = ${reflectDmg}` })
  }

  // 7. mark cards as played
  atk.is_played = true
  def.is_played = true

  // 8. write log entry
  const entry: BattleLogEntry = {
    turn: next.turn,
    side: atkSide,
    attacker_card_id: atkId,
    defender_card_id: defId,
    raw_damage: rawDamage,
    actual_damage: actualDamage,
    attacker_hp_after: next.attacker_hp,
    defender_hp_after: next.defender_hp,
    triggers_fired: triggers,
  }
  next.log.push(entry)

  return next
}

function isOwnedBy(buff: Buff, side: Side, state: BattleState): boolean {
  const cards = side === 'attacker' ? state.attacker_cards : state.defender_cards
  return cards.some(c => c.card.id === buff.source_card_id)
}
