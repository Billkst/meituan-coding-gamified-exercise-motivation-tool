import { create } from 'zustand'
import type { BattleCard, BattleState, FinalizeResult } from '@/lib/battle/types'
import { resolveAttack } from '@/lib/battle/resolver'
import { applyOnPlayTriggers } from '@/lib/battle/skills'
import { aiPickAttacker, aiPickTarget } from '@/lib/battle/ai'
import { supabase } from '@/lib/supabase'

interface BattleStore {
  state: BattleState | null
  initBattle(battleId: number, playerCards: BattleCard[], npcCards: BattleCard[]): void
  selectAttacker(cardId: string): void
  selectTarget(cardId: string): void
  runAITurn(): void
  endTurn(): void
  finishBattle(): Promise<FinalizeResult>
  reset(): void
}

const ANIM_PLAYER_MS = 800
const AI_THINK_MS = 300
const ANIM_AI_MS = 800

export const useBattleStore = create<BattleStore>((set, get) => ({
  state: null,

  initBattle(battleId, playerCards, npcCards) {
    const initial: BattleState = {
      battle_id: battleId,
      turn: 1,
      attacker_hp: 100,
      defender_hp: 100,
      attacker_cards: playerCards,
      defender_cards: npcCards,
      current_phase: 'init',
      selected_attacker_id: null,
      log: [],
      passive_buffs: [],
    }
    set({ state: applyOnPlayTriggers({ ...initial, current_phase: 'pick_attacker' }) })
  },

  selectAttacker(cardId) {
    const s = get().state
    if (!s || s.current_phase !== 'pick_attacker') return
    set({ state: { ...s, selected_attacker_id: cardId, current_phase: 'pick_target' } })
  },

  selectTarget(cardId) {
    const s = get().state
    if (!s || s.current_phase !== 'pick_target' || !s.selected_attacker_id) return
    const next = resolveAttack(s, 'attacker', s.selected_attacker_id, cardId)
    set({ state: { ...next, current_phase: 'animating_player', selected_attacker_id: null } })
    setTimeout(() => {
      const cur = get().state
      if (!cur) return
      set({ state: { ...cur, current_phase: 'ai_thinking' } })
      setTimeout(() => get().runAITurn(), AI_THINK_MS)
    }, ANIM_PLAYER_MS)
  },

  runAITurn() {
    const s = get().state
    if (!s || s.current_phase !== 'ai_thinking') return
    const aiAtk = aiPickAttacker(s)
    const aiTgt = aiPickTarget(s, aiAtk)
    const next = resolveAttack(s, 'defender', aiAtk, aiTgt)
    set({ state: { ...next, current_phase: 'animating_ai' } })
    setTimeout(() => get().endTurn(), ANIM_AI_MS)
  },

  endTurn() {
    const s = get().state
    if (!s) return
    const newTurn = s.turn + 1
    if (newTurn > 8) {
      set({ state: { ...s, turn: 9, current_phase: 'finalizing' } })
    } else {
      set({ state: { ...s, turn: newTurn, current_phase: 'pick_attacker' } })
    }
  },

  async finishBattle() {
    const s = get().state
    if (!s) throw new Error('no battle in progress')
    const { data, error } = await supabase.rpc('finalize_battle' as never, {
      p_battle_id: s.battle_id,
      p_log: s.log,
    } as never)
    if (error) throw error
    set({ state: { ...s, current_phase: 'ended' } })
    return data as FinalizeResult
  },

  reset() {
    set({ state: null })
  },
}))
