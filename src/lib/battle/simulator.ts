import { resolveAttack } from './resolver'
import type { BattleState, TriggerEvent } from './types'

export interface DamagePreview {
  actualDamage: number
  rawDamage: number
  triggers: TriggerEvent[]
}

// Pure preview: resolveAttack already deep-clones state, so caller state is
// untouched. Returns the would-be damage + trigger list, never mutates input.
export function previewDamage(
  state: BattleState,
  atkId: string,
  defId: string,
): DamagePreview {
  const next = resolveAttack(state, 'attacker', atkId, defId)
  const last = next.log[next.log.length - 1]
  return {
    actualDamage: last.actual_damage,
    rawDamage: last.raw_damage,
    triggers: last.triggers_fired,
  }
}
