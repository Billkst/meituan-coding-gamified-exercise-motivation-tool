// Battlefield constants — logical coordinates (18 cols × 32 rows).
// Unit positions are floats; rendering layer scales to pixels.

export const ARENA = {
  cols: 18,
  rows: 32,

  // River runs horizontally; ground units must take a bridge.
  river: { yMin: 15, yMax: 17 },
  bridges: [{ x: 3 }, { x: 14 }] as const,

  // Tower positions + stats (HP scales with level eventually; first version fixed).
  towers: {
    player_king: { x: 8.5, y: 2, hp: 4000, range: 7, hitSpeed: 1.0 },
    player_left: { x: 3, y: 5, hp: 2400, range: 7, hitSpeed: 0.8 },
    player_right: { x: 14, y: 5, hp: 2400, range: 7, hitSpeed: 0.8 },
    enemy_king: { x: 8.5, y: 30, hp: 4000, range: 7, hitSpeed: 1.0 },
    enemy_left: { x: 3, y: 27, hp: 2400, range: 7, hitSpeed: 0.8 },
    enemy_right: { x: 14, y: 27, hp: 2400, range: 7, hitSpeed: 0.8 },
  },

  // Tick + economy timing.
  tickHz: 30,
  matchSeconds: 180,
  overtimeSeconds: 60,
  elixirMaxNormal: 10,
  elixirRateNormalPerSec: 1 / 2.8,
  elixirRateOvertimePerSec: 1 / 1.4,
  elixirStart: 5,

  // Deploy zone constraints (from caster's POV).
  // Player deploys in y ∈ [0, 14]; enemy deploys in y ∈ [18, 32].
  // After breaking opponent's princess tower on a side, deploy zone extends across river on that side.
  playerDeployYMax: 14,
  enemyDeployYMin: 18,

  // Spawn freeze after deploy (s); unit is invulnerable + immobile for this duration.
  spawnFreezeSec: 1.0,

  // Unit despawn fade after death (s).
  deathFadeSec: 0.4,
} as const

export type TowerId = keyof typeof ARENA.towers
export type Side = 'player' | 'enemy'

export const PLAYER_TOWERS: TowerId[] = ['player_king', 'player_left', 'player_right']
export const ENEMY_TOWERS: TowerId[] = ['enemy_king', 'enemy_left', 'enemy_right']

export function towerSide(id: TowerId): Side {
  return id.startsWith('player') ? 'player' : 'enemy'
}

export function isKingTower(id: TowerId): boolean {
  return id === 'player_king' || id === 'enemy_king'
}

/**
 * Pick the closer bridge for a unit at column x.
 * Air units bypass this (they fly straight); ground units route through here.
 */
export function nearestBridgeX(x: number): number {
  const left = ARENA.bridges[0].x
  const right = ARENA.bridges[1].x
  return Math.abs(x - left) <= Math.abs(x - right) ? left : right
}

/**
 * Whether (x, y) is inside the river band.
 */
export function isInRiver(y: number): boolean {
  return y >= ARENA.river.yMin && y <= ARENA.river.yMax
}

/**
 * Whether unit can deploy at (x, y) given side + which enemy princess towers are still alive.
 * Player deploys in own half; once an enemy princess on a lane is destroyed,
 * the player can also deploy on the corresponding half of opponent's territory.
 */
export function canDeployAt(
  side: Side,
  x: number,
  y: number,
  enemyLeftAlive: boolean,
  enemyRightAlive: boolean,
): boolean {
  if (x < 0 || x >= ARENA.cols) return false
  if (y < 0 || y >= ARENA.rows) return false

  if (side === 'player') {
    if (y <= ARENA.playerDeployYMax) return true
    // Crossed river — only allowed if corresponding princess tower destroyed.
    if (y > ARENA.river.yMax) {
      const isLeftSide = x < 9
      if (isLeftSide && !enemyLeftAlive) return true
      if (!isLeftSide && !enemyRightAlive) return true
    }
    return false
  } else {
    // Enemy AI deploys mirror; first version: enemy can always deploy in y ∈ [18, 32].
    return y >= ARENA.enemyDeployYMin
  }
}
