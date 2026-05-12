// Day 23 — Pixi atlas asset loader.
//
// Loads one /sprites/<cardId>.webp + .json atlas per CrCardId in the match
// (player deck ∪ enemy deck). Each atlas exposes 4 frames (idle/walk/attack/
// death). PixiBattlefield reads atlases.get(cardId)?.textures[state] to swap
// sprite frames.
//
// Returns a stable map even when loading is still in-flight, so the renderer
// can render placeholder circles for unknown card ids while real textures
// pour in.

import { useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import type { CrCardId } from '@/clash/lib/cardData'

// IP-safe rename for sprite filenames. Database keeps the original cardId;
// only on-disk sprite paths use the safe name.
const SPRITE_RENAME: Partial<Record<CrCardId, string>> = {
  mini_pekka: 'mini_warrior',
}

export function spriteFilenameFor(cardId: CrCardId): string {
  return SPRITE_RENAME[cardId] ?? cardId
}

export interface ClashAssets {
  loaded: boolean
  error: Error | null
  atlases: Map<CrCardId, PIXI.Spritesheet>
}

const EMPTY: ClashAssets = { loaded: false, error: null, atlases: new Map() }

export function useClashAssets(cardIds: readonly CrCardId[]): ClashAssets {
  const [state, setState] = useState<ClashAssets>(EMPTY)
  // Stable cache key so the effect doesn't refire for every prop ref change.
  const cacheKey = [...new Set(cardIds)].sort().join(',')

  useEffect(() => {
    if (!cacheKey) {
      setState({ loaded: true, error: null, atlases: new Map() })
      return
    }
    let cancelled = false
    const ids = cacheKey.split(',') as CrCardId[]

    Promise.all(
      ids.map(async (id) => {
        const file = spriteFilenameFor(id)
        try {
          const sheet = (await PIXI.Assets.load(
            `/sprites/${file}.json`,
          )) as PIXI.Spritesheet
          return [id, sheet] as const
        } catch (err) {
          // Missing atlas (404, decode error, …) — log but don't fail the whole
          // match. Renderer falls back to a placeholder circle for that card.
          console.warn(`[useClashAssets] missing sprite for ${id}:`, (err as Error).message)
          return [id, null] as const
        }
      }),
    )
      .then((pairs) => {
        if (cancelled) return
        const map = new Map<CrCardId, PIXI.Spritesheet>()
        for (const [id, sheet] of pairs) {
          if (sheet) map.set(id, sheet)
        }
        setState({ loaded: true, error: null, atlases: map })
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ loaded: true, error: err as Error, atlases: new Map() })
        }
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey])

  return state
}
