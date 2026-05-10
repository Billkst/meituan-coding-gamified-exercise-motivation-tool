import type { BattleState } from '@/lib/battle/types'
import CardSlot from './CardSlot'
import { useTranslation } from '@/lib/i18n'

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

  return (
    <div className="flex flex-col gap-6">
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
