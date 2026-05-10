import { useTranslation } from '@/lib/i18n'
import type { BattlePhase } from '@/lib/battle/types'
import type { TranslationKey } from '@/lib/i18n'

const PHASE_KEY: Partial<Record<BattlePhase, TranslationKey>> = {
  pick_attacker: 'arena.battle.phase.pick_attacker',
  pick_target: 'arena.battle.phase.pick_target',
  ai_thinking: 'arena.battle.phase.ai_thinking',
  animating_player: 'arena.battle.phase.ai_thinking',
  animating_ai: 'arena.battle.phase.ai_thinking',
  finalizing: 'arena.battle.phase.ended',
  ended: 'arena.battle.phase.ended',
}

export default function BattlePhaseBanner({ phase }: { phase: BattlePhase }) {
  const { t } = useTranslation()
  const key = PHASE_KEY[phase]
  if (!key) return null
  return (
    <div className="font-display text-xl font-bold uppercase tracking-tight text-text-primary">
      {t(key)}
    </div>
  )
}
