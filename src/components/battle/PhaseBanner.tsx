import { useTranslation, type TranslationKey } from '@/lib/i18n'
import type { BattlePhase } from '@/lib/battle/types'

const PHASE_TEXT: Partial<Record<BattlePhase, TranslationKey>> = {
  pick_attacker: 'battle.phase.your_turn',
  pick_target: 'battle.phase.pick_target',
  animating_player: 'battle.phase.player_strikes',
  ai_thinking: 'battle.phase.ai_thinking',
  animating_ai: 'battle.phase.ai_strikes',
  finalizing: 'battle.phase.resolving',
  ended: 'battle.phase.resolving',
}

const PHASE_TONE: Partial<Record<BattlePhase, string>> = {
  pick_attacker: 'text-accent-primary border-accent-primary/40 bg-accent-primary/10',
  pick_target: 'text-rarity-legendary border-rarity-legendary/50 bg-rarity-legendary/10',
  animating_player: 'text-accent-primary border-accent-primary/30 bg-accent-primary/5',
  ai_thinking: 'text-rarity-epic border-rarity-epic/50 bg-rarity-epic/10',
  animating_ai: 'text-semantic-error border-semantic-error/50 bg-semantic-error/10',
  finalizing: 'text-rarity-legendary border-rarity-legendary/50 bg-rarity-legendary/10',
  ended: 'text-text-tertiary border-white/10 bg-bg-secondary',
}

interface Props {
  phase: BattlePhase
  turn: number
}

export default function PhaseBanner({ phase, turn }: Props) {
  const { t } = useTranslation()
  const textKey = PHASE_TEXT[phase]
  const tone = PHASE_TONE[phase] ?? 'text-text-secondary border-white/10 bg-bg-secondary'

  return (
    <div className={'inline-flex items-center gap-3 px-4 py-1.5 rounded-button border font-mono text-xs uppercase tracking-widest shadow-glow-subtle ' + tone}>
      <span className="font-display font-black tabular-nums">
        {t('battle.turn_label', { n: Math.min(turn, 8) })}
      </span>
      <span className="w-px h-3 bg-current opacity-30" />
      <span className="font-display font-bold">
        {textKey ? t(textKey) : ''}
      </span>
    </div>
  )
}
