// React hook that drives the engine via requestAnimationFrame.
// Holds match state in a ref + forces re-render at ~60fps.
//
// Mid-match F5 recovery: every ~1s the engine writes a snapshot to
// sessionStorage (state + RNG state + AI timer + level table + input
// fingerprint). On a fresh mount with the same input, we rehydrate from
// the snapshot instead of calling initMatch. Tab close still wipes the
// snapshot — F5 is the only recovery path, by design.

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAction, initMatch } from '@/clash/engine/tick'
import { aiDecide, nextDecisionDelay } from '@/clash/engine/ai'
import { makeRng, type SeededRng } from '@/clash/engine/rng'
import type {
  Action,
  MatchState,
  StartMatchInput,
} from '@/clash/engine/types'
import type { CrCardId } from '@/clash/lib/cardData'

const SNAPSHOT_KEY = 'pulse.clash.match.snapshot'
const SNAPSHOT_INTERVAL_MS = 1000

interface MatchSnapshot {
  fingerprint: string
  state: MatchState
  rngState: number
  aiTimer: number
  levels: { player: Record<CrCardId, number>; enemy: Record<CrCardId, number> }
}

function inputFingerprint(input: StartMatchInput): string {
  const tag = (input as { tutorial?: boolean }).tutorial ? 'T' : 'M'
  return [
    tag,
    input.difficulty ?? 'normal',
    input.player.cardIds.join(','),
    input.enemy.cardIds.join(','),
  ].join('|')
}

function readSnapshot(): MatchSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MatchSnapshot
  } catch {
    return null
  }
}

function writeSnapshot(snap: MatchSnapshot) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap))
  } catch {
    // sessionStorage quota / privacy mode — degrade silently.
  }
}

export function clearMatchSnapshot() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SNAPSHOT_KEY)
}

/**
 * UI-only peek at the saved snapshot — extracts the bits ClashMatch needs to
 * decide whether to skip the difficulty selector on mount and which difficulty
 * to preselect. Returns null when no resumable match is saved.
 */
export function peekSavedMatchInfo(): { isTutorial: boolean; difficulty: string } | null {
  const snap = readSnapshot()
  if (!snap) return null
  if (snap.state.phase === 'ended') return null
  // Fingerprint format: `${tag}|${difficulty}|${playerDeck}|${enemyDeck}`
  const parts = snap.fingerprint.split('|')
  if (parts.length < 2) return null
  return { isTutorial: parts[0] === 'T', difficulty: parts[1] }
}

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
  const rngRef = useRef<SeededRng>(makeRng(input?.seed ?? 1))
  const levelsRef = useRef({
    player: input?.player.levels ?? ({} as Record<CrCardId, number>),
    enemy: input?.enemy.levels ?? ({} as Record<CrCardId, number>),
  })
  const aiTimerRef = useRef(0)
  const fingerprintRef = useRef<string>('')
  const lastSaveRef = useRef(0)
  const [, forceRender] = useState(0)
  const isRunningRef = useRef(false)

  const policyRef = useRef(policy)
  policyRef.current = policy

  // (Re)initialize when input changes. Tries to rehydrate from a saved
  // sessionStorage snapshot first; falls back to fresh initMatch.
  useEffect(() => {
    if (!input) {
      stateRef.current = null
      isRunningRef.current = false
      return
    }
    const fp = inputFingerprint(input)
    fingerprintRef.current = fp
    const saved = readSnapshot()
    if (saved && saved.fingerprint === fp && saved.state.phase !== 'ended') {
      // Rehydrate path — picks up where the prior session left off.
      rngRef.current = makeRng(1)
      rngRef.current.restore(saved.rngState)
      levelsRef.current = saved.levels
      stateRef.current = saved.state
      aiTimerRef.current = saved.aiTimer
    } else {
      if (saved) clearMatchSnapshot()
      rngRef.current = makeRng(input.seed ?? Date.now() & 0x7fffffff)
      levelsRef.current = { player: input.player.levels, enemy: input.enemy.levels }
      stateRef.current = initMatch(input, rngRef.current)
      aiTimerRef.current = policyRef.current.nextDelay(stateRef.current, rngRef.current)
    }
    lastSaveRef.current = 0
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
        // Throttled snapshot — 1Hz is enough for F5 recovery; serializing
        // every frame would burn CPU on the JSON.stringify.
        if (now - lastSaveRef.current >= SNAPSHOT_INTERVAL_MS) {
          writeSnapshot({
            fingerprint: fingerprintRef.current,
            state: s,
            rngState: rngRef.current.state(),
            aiTimer: aiTimerRef.current,
            levels: levelsRef.current,
          })
          lastSaveRef.current = now
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
    // Explicit restart wipes any in-progress snapshot so we don't
    // immediately rehydrate the same state we're trying to leave.
    clearMatchSnapshot()
    rngRef.current = makeRng(Date.now() & 0x7fffffff)
    stateRef.current = initMatch(input, rngRef.current)
    aiTimerRef.current = policyRef.current.nextDelay(stateRef.current, rngRef.current)
    lastSaveRef.current = 0
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
