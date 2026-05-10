import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { IconInfoCircle } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useAllCards, useMyCards } from '@/api/cards'
import { useBattleStore } from '@/store/useBattleStore'
import BattleBoard from '@/components/battle/BattleBoard'
import BattleRulesModal from '@/components/battle/BattleRulesModal'
import TurnIndicator from '@/components/battle/TurnIndicator'
import BattlePhaseBanner from '@/components/battle/BattlePhaseBanner'
import type { StartBattleResult } from '@/api/battles'
import type { PvpStartResult } from '@/types/db'
import type { BattleCard } from '@/lib/battle/types'

interface LocationState {
  startResult?: StartBattleResult | PvpStartResult
}

function isPvpStart(s: StartBattleResult | PvpStartResult): s is PvpStartResult {
  return (s as PvpStartResult).kind === 'pvp'
}

export default function ArenaBattle() {
  const { battleId } = useParams<{ battleId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { t, lang } = useTranslation()
  const startResult = (location.state as LocationState | null)?.startResult
  const [rulesOpen, setRulesOpen] = useState(false)

  const state = useBattleStore((s) => s.state)
  const init = useBattleStore((s) => s.initBattle)
  const selectAttacker = useBattleStore((s) => s.selectAttacker)
  const selectTarget = useBattleStore((s) => s.selectTarget)
  const finishBattle = useBattleStore((s) => s.finishBattle)
  const reset = useBattleStore((s) => s.reset)

  const { data: allCards = [] } = useAllCards()
  const { data: myCards = [] } = useMyCards()

  const cardsById = useMemo(() => {
    const m = new Map<string, typeof allCards[number]>()
    for (const c of allCards) m.set(c.id, c)
    return m
  }, [allCards])
  const myStarById = useMemo(() => {
    const m = new Map<string, number>()
    for (const oc of myCards) m.set(oc.card_id, oc.star_level)
    return m
  }, [myCards])

  // Init battle from startResult
  useEffect(() => {
    if (!startResult || !battleId || state) return
    const playerCards: BattleCard[] = startResult.attacker_deck_ids
      .map(id => cardsById.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(c => ({
        card: c,
        star_level: myStarById.get(c.id) ?? 1,
        current_hp: 30,
        is_alive: true,
        is_played: false,
        active_buffs: [],
      }))
    const npcCards: BattleCard[] = startResult.defender_deck_ids
      .map(id => cardsById.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(c => ({
        card: c,
        star_level: 1,
        current_hp: 30,
        is_alive: true,
        is_played: false,
        active_buffs: [],
      }))
    if (playerCards.length === 8 && npcCards.length === 8) {
      init(parseInt(battleId), playerCards, npcCards)
    }
  }, [startResult, battleId, state, cardsById, myStarById, init])

  // Auto-finalize when phase becomes 'finalizing'
  useEffect(() => {
    if (state?.current_phase !== 'finalizing') return
    finishBattle().then(() => {
      navigate(`/arena/result/${battleId}`, { replace: true })
    }).catch((e) => {
      console.error('finalize failed', e)
    })
  }, [state?.current_phase, finishBattle, navigate, battleId])

  // Cleanup on unmount
  useEffect(() => {
    return () => { reset() }
  }, [reset])

  if (!startResult || !state) {
    return (
      <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12 text-center">
        <div className="font-mono text-sm uppercase tracking-widest text-text-tertiary">
          {t('arena.battle.phase.ai_thinking')}
        </div>
      </div>
    )
  }

  const opponentName = isPvpStart(startResult)
    ? startResult.opponent_username
    : (lang === 'zh' ? startResult.npc_name_zh : startResult.npc_name_en)

  return (
    <div className="max-w-container mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <TurnIndicator turn={state.turn} />
        <div className="flex items-center gap-3">
          <BattlePhaseBanner phase={state.current_phase} />
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            aria-label={t('battle.rules.open')}
            title={t('battle.rules.open')}
            className="text-text-tertiary hover:text-accent-primary p-1.5 border border-white/10 rounded-button hover:border-accent-primary"
          >
            <IconInfoCircle size={16} />
          </button>
        </div>
      </div>
      <BattleBoard
        state={state}
        npcName={opponentName}
        onPickAttacker={selectAttacker}
        onPickTarget={selectTarget}
      />
      <BattleRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
