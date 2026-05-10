// Clash card definitions — mirror of supabase/migrations/20260510000024 cr_cards seed.
// Used for type safety + offline tests + level-scaling math (server is the source of truth at runtime).

export type CrCardId =
  | 'knight'
  | 'archer'
  | 'goblin'
  | 'arrows'
  | 'cannon'
  | 'giant'
  | 'musketeer'
  | 'valkyrie'
  | 'mini_pekka'
  | 'tesla'
  | 'baby_dragon'
  | 'lightning'

export type CrCardType = 'troop' | 'spell' | 'building'
export type CrTargetType = 'ground' | 'air+ground' | 'building'
export type CrRarity = 'common' | 'rare' | 'epic'

export interface CrCardBaseStats {
  hp?: number
  dmg?: number
  hit_speed?: number
  move_speed?: number
  range?: number
  target?: CrTargetType
  count?: number
  radius?: number
  max_targets?: number
}

export interface CrCardDef {
  id: CrCardId
  name_zh: string
  name_en: string
  card_type: CrCardType
  cost: number
  rarity: CrRarity
  emoji: string
  unlock_cost: number
  base_stats: CrCardBaseStats
}

export const CR_CARDS: CrCardDef[] = [
  {
    id: 'knight',
    name_zh: '骑士',
    name_en: 'Knight',
    card_type: 'troop',
    cost: 3,
    rarity: 'common',
    emoji: '⚔️',
    unlock_cost: 0,
    base_stats: { hp: 1500, dmg: 150, hit_speed: 1.2, move_speed: 60, range: 1, target: 'ground', count: 1 },
  },
  {
    id: 'archer',
    name_zh: '弓箭手',
    name_en: 'Archer',
    card_type: 'troop',
    cost: 3,
    rarity: 'common',
    emoji: '🏹',
    unlock_cost: 0,
    base_stats: { hp: 250, dmg: 90, hit_speed: 1.0, move_speed: 60, range: 5, target: 'air+ground', count: 2 },
  },
  {
    id: 'goblin',
    name_zh: '哥布林',
    name_en: 'Goblin',
    card_type: 'troop',
    cost: 2,
    rarity: 'common',
    emoji: '👺',
    unlock_cost: 0,
    base_stats: { hp: 200, dmg: 110, hit_speed: 1.1, move_speed: 120, range: 1, target: 'ground', count: 3 },
  },
  {
    id: 'arrows',
    name_zh: '箭雨',
    name_en: 'Arrows',
    card_type: 'spell',
    cost: 3,
    rarity: 'common',
    emoji: '🌧️',
    unlock_cost: 0,
    base_stats: { dmg: 250, radius: 4 },
  },
  {
    id: 'cannon',
    name_zh: '加农炮',
    name_en: 'Cannon',
    card_type: 'building',
    cost: 3,
    rarity: 'common',
    emoji: '💥',
    unlock_cost: 0,
    base_stats: { hp: 700, dmg: 110, hit_speed: 1.0, range: 6, target: 'ground' },
  },
  {
    id: 'giant',
    name_zh: '巨人',
    name_en: 'Giant',
    card_type: 'troop',
    cost: 5,
    rarity: 'rare',
    emoji: '🗿',
    unlock_cost: 0,
    base_stats: { hp: 3500, dmg: 200, hit_speed: 1.5, move_speed: 45, range: 1, target: 'building', count: 1 },
  },
  {
    id: 'musketeer',
    name_zh: '火枪手',
    name_en: 'Musketeer',
    card_type: 'troop',
    cost: 4,
    rarity: 'rare',
    emoji: '🔫',
    unlock_cost: 0,
    base_stats: { hp: 700, dmg: 220, hit_speed: 1.1, move_speed: 60, range: 6, target: 'air+ground', count: 1 },
  },
  {
    id: 'valkyrie',
    name_zh: '女武神',
    name_en: 'Valkyrie',
    card_type: 'troop',
    cost: 4,
    rarity: 'rare',
    emoji: '🛡️',
    unlock_cost: 0,
    base_stats: { hp: 1700, dmg: 230, hit_speed: 1.5, move_speed: 60, range: 1.2, target: 'ground', count: 1 },
  },
  {
    id: 'mini_pekka',
    name_zh: '小皮卡',
    name_en: 'Mini P.E.K.K.A',
    card_type: 'troop',
    cost: 4,
    rarity: 'rare',
    emoji: '🤖',
    unlock_cost: 10,
    base_stats: { hp: 1300, dmg: 600, hit_speed: 1.6, move_speed: 90, range: 1, target: 'ground', count: 1 },
  },
  {
    id: 'tesla',
    name_zh: '特斯拉电塔',
    name_en: 'Tesla',
    card_type: 'building',
    cost: 4,
    rarity: 'rare',
    emoji: '⚡',
    unlock_cost: 10,
    base_stats: { hp: 800, dmg: 130, hit_speed: 1.1, range: 6, target: 'air+ground' },
  },
  {
    id: 'baby_dragon',
    name_zh: '小宝龙',
    name_en: 'Baby Dragon',
    card_type: 'troop',
    cost: 4,
    rarity: 'epic',
    emoji: '🐲',
    unlock_cost: 20,
    base_stats: { hp: 1100, dmg: 100, hit_speed: 1.6, move_speed: 60, range: 3.5, target: 'air+ground', count: 1 },
  },
  {
    id: 'lightning',
    name_zh: '闪电',
    name_en: 'Lightning',
    card_type: 'spell',
    cost: 6,
    rarity: 'epic',
    emoji: '⛈️',
    unlock_cost: 20,
    base_stats: { dmg: 600, radius: 3, max_targets: 3 },
  },
]

export const CR_CARDS_BY_ID: Record<CrCardId, CrCardDef> = CR_CARDS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<CrCardId, CrCardDef>,
)

/**
 * Linear scaling: level 1 = 100%, level 11 = 200%, +10% per level.
 * Scales hp + dmg only; speeds, ranges, etc. stay constant.
 */
export function scaleStatsForLevel(base: CrCardBaseStats, level: number): CrCardBaseStats {
  const clamped = Math.max(1, Math.min(11, level))
  const mult = 1 + (clamped - 1) * 0.1
  return {
    ...base,
    ...(base.hp !== undefined ? { hp: Math.round(base.hp * mult) } : {}),
    ...(base.dmg !== undefined ? { dmg: Math.round(base.dmg * mult) } : {}),
  }
}

/**
 * Upgrade cost lookup for level transition (current → current+1).
 * Mirror of the upgrade table inside cr_upgrade_cost RPC.
 */
export interface UpgradeCost {
  gold: number
  shards: number
}

export const UPGRADE_COSTS: Record<number, UpgradeCost> = {
  2: { gold: 5, shards: 2 },
  3: { gold: 20, shards: 4 },
  4: { gold: 50, shards: 10 },
  5: { gold: 150, shards: 20 },
  6: { gold: 400, shards: 50 },
  7: { gold: 1000, shards: 100 },
  8: { gold: 2000, shards: 200 },
  9: { gold: 4000, shards: 400 },
  10: { gold: 8000, shards: 800 },
  11: { gold: 20000, shards: 1500 },
}

export function nextUpgradeCost(currentLevel: number): UpgradeCost | null {
  const target = currentLevel + 1
  if (target > 11) return null
  return UPGRADE_COSTS[target] ?? null
}
