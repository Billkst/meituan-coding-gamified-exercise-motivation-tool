import { describe, it, expect } from 'vitest'
import {
  ARENA,
  PLAYER_TOWERS,
  ENEMY_TOWERS,
  towerSide,
  isKingTower,
  nearestBridgeX,
  isInRiver,
  canDeployAt,
} from '@/clash/lib/arena'

describe('ARENA constants', () => {
  it('matches Clash Royale 18×32 layout', () => {
    expect(ARENA.cols).toBe(18)
    expect(ARENA.rows).toBe(32)
  })

  it('has 6 towers (3 per side)', () => {
    expect(PLAYER_TOWERS).toHaveLength(3)
    expect(ENEMY_TOWERS).toHaveLength(3)
  })

  it('king tower has higher HP than princess tower', () => {
    expect(ARENA.towers.player_king.hp).toBeGreaterThan(ARENA.towers.player_left.hp)
    expect(ARENA.towers.enemy_king.hp).toBeGreaterThan(ARENA.towers.enemy_left.hp)
  })

  it('elixir math: normal rate ≈ 0.357/s, overtime double', () => {
    expect(ARENA.elixirRateNormalPerSec).toBeCloseTo(1 / 2.8, 4)
    expect(ARENA.elixirRateOvertimePerSec).toBeCloseTo(2 / 2.8, 4)
  })
})

describe('towerSide', () => {
  it('classifies player vs enemy correctly', () => {
    expect(towerSide('player_king')).toBe('player')
    expect(towerSide('player_left')).toBe('player')
    expect(towerSide('enemy_right')).toBe('enemy')
  })
})

describe('isKingTower', () => {
  it('identifies king towers', () => {
    expect(isKingTower('player_king')).toBe(true)
    expect(isKingTower('enemy_king')).toBe(true)
    expect(isKingTower('player_left')).toBe(false)
  })
})

describe('nearestBridgeX', () => {
  it('routes left-side units to left bridge (x=3)', () => {
    expect(nearestBridgeX(0)).toBe(3)
    expect(nearestBridgeX(8)).toBe(3)
  })

  it('routes right-side units to right bridge (x=14)', () => {
    expect(nearestBridgeX(9)).toBe(14)
    expect(nearestBridgeX(17)).toBe(14)
  })
})

describe('isInRiver', () => {
  it('returns true inside river band', () => {
    expect(isInRiver(15)).toBe(true)
    expect(isInRiver(16)).toBe(true)
    expect(isInRiver(17)).toBe(true)
  })

  it('returns false outside river band', () => {
    expect(isInRiver(14)).toBe(false)
    expect(isInRiver(18)).toBe(false)
  })
})

describe('canDeployAt (player side)', () => {
  it('allows deploys in own half (y ≤ 14)', () => {
    expect(canDeployAt('player', 5, 5, true, true)).toBe(true)
    expect(canDeployAt('player', 9, 14, true, true)).toBe(true)
  })

  it('blocks deploys past river when both princess towers alive', () => {
    expect(canDeployAt('player', 5, 20, true, true)).toBe(false)
    expect(canDeployAt('player', 14, 27, true, true)).toBe(false)
  })

  it('allows left-side past-river when enemy left princess destroyed', () => {
    expect(canDeployAt('player', 3, 22, false, true)).toBe(true)
    // But still blocks right side
    expect(canDeployAt('player', 14, 22, false, true)).toBe(false)
  })

  it('allows right-side past-river when enemy right princess destroyed', () => {
    expect(canDeployAt('player', 14, 22, true, false)).toBe(true)
    expect(canDeployAt('player', 3, 22, true, false)).toBe(false)
  })

  it('blocks out-of-bounds', () => {
    expect(canDeployAt('player', -1, 5, true, true)).toBe(false)
    expect(canDeployAt('player', 18, 5, true, true)).toBe(false)
    expect(canDeployAt('player', 5, -1, true, true)).toBe(false)
  })
})
