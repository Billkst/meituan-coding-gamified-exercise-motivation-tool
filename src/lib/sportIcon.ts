import type { SportCategory } from '@/types/db'

// Tabler webfont icons use kebab-case class names. The DB stores PascalCase
// component names ("IconRun"), so we strip the "Icon" prefix and lowercase.
// Kept for legacy callers; new code should prefer sportEmoji() because tabler
// v3 doesn't ship icons for several names we seeded (boxing-glove, climbing,
// karate, yoga, etc.) and they render as blank glyphs.
export function tablerClass(componentName: string): string {
  const kebab = componentName
    .replace(/^Icon/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
  return `ti ti-${kebab}`
}

// Emoji per sport id — Unicode-standard, every browser ships color glyphs,
// 100% coverage by construction (one entry per row in sports_seed.sql).
// Indexed by sports.id, NOT by sports.icon (which is the deprecated tabler
// component name that may not exist in the webfont).
const SPORT_EMOJI: Record<string, string> = {
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  jump_rope: '🪢',
  hiit: '🔥',
  rowing: '🚣',
  weightlifting: '🏋️',
  boxing: '🥊',
  climbing: '🧗',
  calisthenics: '💪',
  basketball: '🏀',
  football: '⚽',
  badminton: '🏸',
  pingpong: '🏓',
  tennis: '🎾',
  volleyball: '🏐',
  frisbee: '🥏',
  yoga: '🧘',
  pilates: '🤸',
  dance: '💃',
  taichi: '☯️',
  martial_arts: '🥋',
  judo: '🤼',
  hiking: '🥾',
  skateboarding: '🛹',
  skiing: '⛷️',
}

export function sportEmoji(id: string): string {
  return SPORT_EMOJI[id] ?? '🏅'
}

// Visual identity per sport category. Used for the icon "tile" background
// (gradient) and the selection ring tint. Picked so the 6 categories are
// instantly distinguishable on Step2Sports / Sports list / Workout picker.
export const CATEGORY_GRADIENT: Record<SportCategory, string> = {
  cardio: 'from-orange-400 to-red-600',
  strength: 'from-red-500 to-rose-700',
  ball: 'from-sky-400 to-blue-700',
  flex: 'from-purple-400 to-fuchsia-700',
  martial: 'from-amber-400 to-yellow-700',
  outdoor: 'from-emerald-400 to-green-700',
}

export const CATEGORY_ACCENT_BORDER: Record<SportCategory, string> = {
  cardio: 'border-orange-400/60',
  strength: 'border-red-400/60',
  ball: 'border-sky-400/60',
  flex: 'border-purple-400/60',
  martial: 'border-amber-400/60',
  outdoor: 'border-emerald-400/60',
}

export const CATEGORY_GLOW: Record<SportCategory, string> = {
  cardio: 'shadow-[0_0_20px_rgba(251,146,60,0.35)]',
  strength: 'shadow-[0_0_20px_rgba(244,63,94,0.35)]',
  ball: 'shadow-[0_0_20px_rgba(56,189,248,0.35)]',
  flex: 'shadow-[0_0_20px_rgba(192,132,252,0.35)]',
  martial: 'shadow-[0_0_20px_rgba(251,191,36,0.35)]',
  outdoor: 'shadow-[0_0_20px_rgba(52,211,153,0.35)]',
}
