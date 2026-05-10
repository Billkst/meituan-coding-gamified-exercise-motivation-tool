import { useMemo } from 'react'
import { IconUser, IconRobot } from '@tabler/icons-react'
import type { BattleState } from '@/lib/battle/types'
import CardSlot from './CardSlot'
import RecommendationHint from './RecommendationHint'
import PhaseBanner from './PhaseBanner'
import DamageFloat from './DamageFloat'
import { useTranslation } from '@/lib/i18n'
import { previewDamage } from '@/lib/battle/simulator'
import { recommendNextMove } from '@/lib/battle/advisor'

interface Props {
  state: BattleState
  onPickAttacker(cardId: string): void
  onPickTarget(cardId: string): void
  opponentName: string
  opponentLevel?: number
  yourName: string
  yourLevel?: number
}

export default function BattleArena({
  state,
  onPickAttacker,
  onPickTarget,
  opponentName,
  opponentLevel,
  yourName,
  yourLevel,
}: Props) {
  const { t } = useTranslation()
  const playerSelectable = state.current_phase === 'pick_attacker'
  const targetSelectable = state.current_phase === 'pick_target'

  // Pre-compute damage preview for every alive enemy during pick_target.
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

  // Determine which cards are striking/shaking based on current phase + last log entry.
  const lastLog = state.log[state.log.length - 1]
  const isPlayerStrike = state.current_phase === 'animating_player' && lastLog?.side === 'attacker'
  const isAIStrike = state.current_phase === 'animating_ai' && lastLog?.side === 'defender'

  return (
    <div className="relative max-w-container mx-auto">
      {/* Battle stage background */}
      <div
        className="rounded-card overflow-hidden border border-white/10 shadow-glow-subtle"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(20,20,30,0.8) 0%, rgba(8,8,12,0.95) 70%)',
        }}
      >
        {/* ============== ENEMY ZONE ============== */}
        <div
          className="relative px-4 md:px-6 pt-5 pb-4"
          style={{
            background: 'linear-gradient(180deg, rgba(255,70,70,0.06) 0%, rgba(255,70,70,0.02) 100%)',
          }}
        >
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-semantic-error/20 border-2 border-semantic-error/50 flex items-center justify-center flex-shrink-0">
                <IconRobot size={18} className="text-semantic-error" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-semantic-error/80 mb-0.5">
                  {t('arena.zone.opponent')}
                </div>
                <div className="font-display font-bold text-base md:text-lg truncate text-text-primary">
                  {opponentName}{opponentLevel != null ? ` · L${opponentLevel}` : ''}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="font-mono text-[9px] uppercase tracking-widest text-semantic-error/80">
                HP
              </div>
              <div className="font-display font-black text-2xl md:text-3xl tabular-nums text-text-primary">
                {state.defender_hp}<span className="text-text-tertiary text-base">/100</span>
              </div>
            </div>
          </div>
          <HpBar hp={state.defender_hp} tone="enemy" />

          <div className="grid grid-cols-4 gap-2 md:gap-3 mt-4">
            {state.defender_cards.map((c) => {
              const striking = isAIStrike && lastLog?.attacker_card_id === c.card.id ? 'down' : null
              const shaking = isPlayerStrike && lastLog?.defender_card_id === c.card.id
              const damage = isPlayerStrike && lastLog?.defender_card_id === c.card.id
                ? lastLog.actual_damage
                : null
              return (
                <div key={c.card.id} className="relative">
                  <CardSlot
                    card={c}
                    side="opponent"
                    selectable={targetSelectable}
                    damagePreview={previewMap.get(c.card.id) ?? null}
                    recommended={targetSelectable && rec.target_id === c.card.id}
                    striking={striking}
                    shaking={shaking}
                    onClick={() => targetSelectable && onPickTarget(c.card.id)}
                  />
                  {damage != null && <DamageFloat amount={damage} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ============== BATTLE LINE / PHASE ============== */}
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="relative flex items-center justify-center py-3">
            <PhaseBanner phase={state.current_phase} turn={state.turn} />
          </div>
        </div>

        {/* ============== PLAYER ZONE ============== */}
        <div
          className="relative px-4 md:px-6 pt-4 pb-5"
          style={{
            background: 'linear-gradient(0deg, rgba(182,255,60,0.06) 0%, rgba(182,255,60,0.02) 100%)',
          }}
        >
          <div className="grid grid-cols-4 gap-2 md:gap-3 mb-4">
            {state.attacker_cards.map((c) => {
              const striking = isPlayerStrike && lastLog?.attacker_card_id === c.card.id ? 'up' : null
              const shaking = isAIStrike && lastLog?.defender_card_id === c.card.id
              const damage = isAIStrike && lastLog?.defender_card_id === c.card.id
                ? lastLog.actual_damage
                : null
              return (
                <div key={c.card.id} className="relative">
                  <CardSlot
                    card={c}
                    side="player"
                    selectable={playerSelectable}
                    selected={state.selected_attacker_id === c.card.id}
                    recommended={playerSelectable && rec.attacker_id === c.card.id}
                    striking={striking}
                    shaking={shaking}
                    onClick={() => playerSelectable && onPickAttacker(c.card.id)}
                  />
                  {damage != null && <DamageFloat amount={damage} />}
                </div>
              )
            })}
          </div>

          <HpBar hp={state.attacker_hp} tone="player" />

          <div className="flex items-center justify-between mt-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-accent-primary/20 border-2 border-accent-primary/60 flex items-center justify-center flex-shrink-0">
                <IconUser size={18} className="text-accent-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-0.5">
                  {t('arena.zone.you')}
                </div>
                <div className="font-display font-bold text-base md:text-lg truncate text-text-primary">
                  {yourName}{yourLevel != null ? ` · L${yourLevel}` : ''}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="font-mono text-[9px] uppercase tracking-widest text-accent-primary">
                HP
              </div>
              <div className="font-display font-black text-2xl md:text-3xl tabular-nums text-text-primary">
                {state.attacker_hp}<span className="text-text-tertiary text-base">/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <RecommendationHint state={state} />
      </div>
    </div>
  )
}

function HpBar({ hp, tone }: { hp: number; tone: 'player' | 'enemy' }) {
  const pct = Math.max(0, Math.min(100, hp))
  const color = tone === 'player' ? 'bg-accent-primary' : 'bg-semantic-error'
  return (
    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
      <div
        className={'h-full transition-all duration-500 ' + color}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
