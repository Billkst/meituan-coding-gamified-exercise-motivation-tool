// React hook that drives the engine via requestAnimationFrame.
// Holds match state in a ref + forces re-render at ~60fps.

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAction, initMatch } from '@/clash/engine/tick'
import { aiDecide, nextDecisionDelay } from '@/clash/engine/ai'
import { makeRng } from '@/clash/engine/rng'
import type {
  Action,
  MatchState,
  StartMatchInput,
} from '@/clash/engine/types'
import type { CrCardId } from '@/clash/lib/cardData'

export interface AiPolicy {
  decide: (state: MatchState, rng: () => number) => Action | null
  nextDelay: (state: MatchState, rng: () => number) => number
}

const DEFAULT_POLICY: AiPolicy = {
  decide: aiDecide,
  nextDelay: nextDecisionDelay,
}

export interface UseClashEngineApi {
  state: MatchState
  isRunning: boolean
  /** Player deploy. Returns true if accepted (sufficient elixir + valid). */
  deploy: (handIndex: number, pos: { x: number; y: number }) => boolean
  /** Restart with the same input. */
  restart: () => void
  /** Pause the tick loop (useful for ClashResult overlay). */
  pause: () => void
  /** Resume after a pause. */
  resume: () => void
}

export function useClashEngine(
  input: StartMatchInput | null,
  policy: AiPolicy = DEFAULT_POLICY,
): UseClashEngineApi {
  const stateRef = useRef<MatchState | null>(null)
  const rngRef = useRef<() => number>(makeRng(input?.seed ?? 1))
  const levelsRef = useRef({
    player: input?.player.levels ?? ({} as Record<CrCardId, number>),
    enemy: input?.enemy.levels ?? ({} as Record<CrCardId, number>),
  })
  const aiTimerRef = useRef(0)
  const [, forceRender] = useState(0)
  const isRunningRef = useRef(false)

  const policyRef = useRef(policy)
  policyRef.current = policy

  // (Re)initialize when input changes.
  useEffect(() => {
    if (!input) {
      stateRef.current = null
      isRunningRef.current = false
      return
    }
    rngRef.current = makeRng(input.seed ?? Date.now() & 0x7fffffff)
    levelsRef.current = { player: input.player.levels, enemy: input.enemy.levels }
    stateRef.current = initMatch(input, rngRef.current)
    aiTimerRef.current = policyRef.current.nextDelay(stateRef.current, rngRef.current)
    isRunningRef.current = true
    forceRender((n) => n + 1)
  }, [input])

  // RAF loop.
  useEffect(() => {
    let raf = 0
    let lastTs = performance.now()
    const loop = (now: number) => {
      const dtSec = Math.min(0.05, (now - lastTs) / 1000)
      lastTs = now
      const s = stateRef.current
      if (s && isRunningRef.current && s.phase !== 'ended') {
        applyAction(s, { kind: 'tick', dtSec }, rngRef.current, levelsRef.current)

        aiTimerRef.current -= dtSec
        if (aiTimerRef.current <= 0) {
          const action = policyRef.current.decide(s, rngRef.current)
          if (action) applyAction(s, action, rngRef.current, levelsRef.current)
          aiTimerRef.current = policyRef.current.nextDelay(s, rngRef.current)
        }
        forceRender((n) => (n + 1) & 0xffff)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const deploy = useCallback((handIndex: number, pos: { x: number; y: number }) => {
    const s = stateRef.current
    if (!s) return false
    const before = s.units.length + s.log.length
    applyAction(s, { kind: 'deploy', side: 'player', handIndex, pos }, rngRef.current, levelsRef.current)
    const after = s.units.length + s.log.length
    forceRender((n) => n + 1)
    return after > before
  }, [])

  const restart = useCallback(() => {
    if (!input) return
    rngRef.current = makeRng(Date.now() & 0x7fffffff)
    stateRef.current = initMatch(input, rngRef.current)
    aiTimerRef.current = policyRef.current.nextDelay(stateRef.current, rngRef.current)
    isRunningRef.current = true
    forceRender((n) => n + 1)
  }, [input])

  const pause = useCallback(() => {
    isRunningRef.current = false
    forceRender((n) => n + 1)
  }, [])

  const resume = useCallback(() => {
    isRunningRef.current = true
    forceRender((n) => n + 1)
  }, [])

  // Empty placeholder before init — only valid when input is non-null.
  return {
    state: stateRef.current as MatchState,
    isRunning: isRunningRef.current,
    deploy,
    restart,
    pause,
    resume,
  }
}

// Action dispatch helper (re-exported for tests / direct callers).
export function dispatch(
  state: MatchState,
  action: Action,
  rng: () => number,
  levels: { player: Record<CrCardId, number>; enemy: Record<CrCardId, number> },
): MatchState {
  return applyAction(state, action, rng, levels)
}
