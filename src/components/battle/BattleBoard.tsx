import { useMemo } from 'react'
import type { BattleState } from '@/lib/battle/types'
import CardSlot from './CardSlot'
import RecommendationHint from './RecommendationHint'
import { useTranslation } from '@/lib/i18n'
import { previewDamage } from '@/lib/battle/simulator'
import { recommendNextMove } from '@/lib/battle/advisor'

interface Props {
  state: BattleState
  onPickAttacker(cardId: string): void
  onPickTarget(cardId: string): void
  npcName: string
}

export default function BattleBoard({ state, onPickAttacker, onPickTarget, npcName }: Props) {
  const { t } = useTranslation()
  const playerSelectable = state.current_phase === 'pick_attacker'
  const targetSelectable = state.current_phase === 'pick_target'

  // Pre-compute damage preview for every alive enemy, only during pick_target.
  const previewMap = useMemo(() => {
    if (!targetSelectable || !state.selected_attacker_id) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const d of state.defender_cards) {
      if (!d.is_alive) continue
      const p = previewDamage(state, state.selected_attacker_id, d.card.id)
      map.set(d.card.id, p.actualDamage)
    }
    return map
  }, [state, targetSelectable])

  // Highlight the recommended attacker (pick_attacker) or target (pick_target).
  const rec = useMemo(() => recommendNextMove(state), [state])

  return (
    <div className="flex flex-col gap-6">
      <RecommendationHint state={state} />

      {/* opponent header */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-display font-bold text-lg">{npcName}</div>
          <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            {t('arena.battle.npc_hp')} {state.defender_hp}/100
          </div>
        </div>
        <HpBar hp={state.defender_hp} />
      </div>

      {/* opponent cards */}
      <div className="grid grid-cols-4 gap-3">
        {state.defender_cards.map((c) => (
          <CardSlot
            key={c.card.id}
            card={c}
            side="opponent"
            selectable={targetSelectable}
            damagePreview={previewMap.get(c.card.id) ?? null}
            recommended={targetSelectable && rec.target_id === c.card.id}
            onClick={() => targetSelectable && onPickTarget(c.card.id)}
          />
        ))}
      </div>

      {/* player cards */}
      <div className="grid grid-cols-4 gap-3">
        {state.attacker_cards.map((c) => (
          <CardSlot
            key={c.card.id}
            card={c}
            side="player"
            selectable={playerSelectable}
            selected={state.selected_attacker_id === c.card.id}
            recommended={playerSelectable && rec.attacker_id === c.card.id}
            onClick={() => playerSelectable && onPickAttacker(c.card.id)}
          />
        ))}
      </div>

      {/* player header */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            {t('arena.battle.your_hp')} {state.attacker_hp}/100
          </div>
        </div>
        <HpBar hp={state.attacker_hp} />
      </div>
    </div>
  )
}

function HpBar({ hp }: { hp: number }) {
  const pct = Math.max(0, Math.min(100, hp))
  return (
    <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full bg-accent-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
