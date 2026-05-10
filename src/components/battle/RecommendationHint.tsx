import { useState } from 'react'
import { IconBulb, IconX } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { BattleState } from '@/lib/battle/types'
import { recommendNextMove } from '@/lib/battle/advisor'

const HIDE_KEY = 'pulse.battle.hide_hint'

interface Props {
  state: BattleState
}

function findCardName(state: BattleState, cardId: string, lang: 'zh' | 'en'): string {
  const all = [...state.attacker_cards, ...state.defender_cards]
  const found = all.find((c) => c.card.id === cardId)
  if (!found) return cardId
  return lang === 'zh' ? found.card.name_zh : found.card.name_en
}

export default function RecommendationHint({ state }: Props) {
  const { t, lang } = useTranslation()
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem(HIDE_KEY) === '1'
  })

  if (hidden) return null

  const rec = recommendNextMove(state)

  // Only render during decision phases with an actionable suggestion.
  if (rec.phase === 'none' || rec.expected_damage == null) return null

  const dismiss = () => {
    window.sessionStorage.setItem(HIDE_KEY, '1')
    setHidden(true)
  }

  let body: string
  if (rec.phase === 'pick_attacker' && rec.attacker_id && rec.target_id) {
    body = t('battle.hint.attacker_phase', {
      atk: findCardName(state, rec.attacker_id, lang),
      def: findCardName(state, rec.target_id, lang),
      dmg: rec.expected_damage,
    })
  } else if (rec.phase === 'pick_target' && rec.target_id) {
    body = t('battle.hint.target_phase', {
      def: findCardName(state, rec.target_id, lang),
      dmg: rec.expected_damage,
    })
  } else {
    return null
  }

  return (
    <div className="bg-rarity-legendary/10 border border-rarity-legendary/40 rounded-card px-4 py-2 flex items-center gap-2 mb-4 shadow-glow-subtle">
      <IconBulb size={14} className="text-rarity-legendary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-rarity-legendary mr-2">
          {t('battle.hint.label')}
        </span>
        <span className="font-body text-xs text-text-primary">{body}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        title={t('battle.hint.dismiss')}
        className="text-text-tertiary hover:text-text-primary p-1 flex-shrink-0"
      >
        <IconX size={14} />
      </button>
    </div>
  )
}
