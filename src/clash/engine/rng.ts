// Deterministic LCG for reproducible matches (replay + tests).
// Mulberry32 — fast 32-bit PRNG, well-distributed for game purposes.
//
// The returned function is also a SeededRng — it exposes .state() and
// .restore(n) so the match engine can serialize / rehydrate the RNG
// across a page reload (mid-match F5 recovery). Plain `() => number`
// callers keep working unchanged.

export interface SeededRng {
  (): number
  state: () => number
  restore: (s: number) => void
}

export function makeRng(seed: number): SeededRng {
  let s = (seed | 0) || 1
  const fn = function () {
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  } as SeededRng
  fn.state = () => s
  fn.restore = (n: number) => {
    s = (n | 0) || 1
  }
  return fn
}

/** Pick a random element using the supplied rng; throws on empty. */
export function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error('pick: empty array')
  return arr[Math.floor(rng() * arr.length)]
}

/** Shuffle (Fisher-Yates) using the rng; mutates a copy and returns it. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
