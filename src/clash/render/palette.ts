// Day 26 — Single source of truth for Pixi-format colors used by the
// battlefield renderer.
//
// Pixi.Graphics.fill / .stroke take uint32 colors; CSS vars are strings.
// Rather than parse CSS on every frame, we maintain these constants in one
// place and keep them in lock-step with DESIGN.md tokens. If you change a
// token in DESIGN.md, change the matching constant here.
//
// Mapping (DESIGN.md → palette.ts):
//   --bg-primary        #0a0e1a   → BG_PRIMARY
//   --accent-primary    #b6ff3c   → ACCENT_PRIMARY
//   --accent-pink       #ff3c8c   → ACCENT_PINK   (used for enemy side)
//   --rarity-rare       #3c8cff   → RIVER         (semantic-info also #3c8cff)
//   --rarity-legendary  #ffc83c   → KING          (used for king tower halo)
//
// Non-token-derived colors below carry an explicit comment.

export const BG_PRIMARY = 0x0a0e1a // --bg-primary
export const ACCENT_PRIMARY = 0xb6ff3c // --accent-primary; player side, lime accents
export const ACCENT_PINK = 0xff3c70 // close to --accent-pink (#ff3c8c) but warmer for enemy clarity at small sizes
export const RIVER = 0x3c8cff // --semantic-info / --rarity-rare
export const KING = 0xffd23c // ~--rarity-legendary (#ffc83c) with slightly more saturation for the gold halo
export const GRID_WHITE = 0xffffff // non-token; only used at 4% alpha
export const SHADOW_BLACK = 0x000000 // non-token; hp-bar backgrounds + sprite outlines
export const FIRE_ORANGE = 0xff8a3c // non-token; fireball + dragon attack tint
export const BRIDGE = 0xb37050 // non-token; wooden bridge color, no DESIGN equivalent

// Aliases used elsewhere in the render layer — kept as a separate export so
// callers don't have to remember which raw constant maps to which semantic.
// Typed as `number` (not literal `as const`) so callers can pass these where
// generic uint32 colors are expected without TypeScript narrowing complaints.
export const PALETTE: Record<
  | 'bg'
  | 'grid'
  | 'river'
  | 'bridge'
  | 'player'
  | 'enemy'
  | 'king'
  | 'deploy'
  | 'shadow'
  | 'fire',
  number
> = {
  bg: BG_PRIMARY,
  grid: GRID_WHITE,
  river: RIVER,
  bridge: BRIDGE,
  player: ACCENT_PRIMARY,
  enemy: ACCENT_PINK,
  king: KING,
  deploy: ACCENT_PRIMARY,
  shadow: SHADOW_BLACK,
  fire: FIRE_ORANGE,
}
