import { useUIStore } from '@/store/useUIStore'

const dict = {
  zh: {
    // Brand / nav
    'nav.tagline': 'v0.1 · 测评作业',
    'nav.dashboard': '主页',
    'nav.sports': '运动',
    'nav.workout': '打卡',
    'nav.loot': '抽卡',
    'nav.arena': '对战',
    'nav.library': '卡库',
    'nav.deck': '卡组',

    // Dashboard
    'dashboard.section': '§ 01 · 主页',
    'dashboard.welcome': '欢迎回来，{name}',
    'dashboard.streak_label': '连续 {n} 天',
    'dashboard.streak_sub': '↑ 距离第 50 天奖励 · 4 秒呼吸 · 霓虹光晕',
    'dashboard.total_cards': '总卡牌',
    'dashboard.total_cards_sub': '共 120 张 · 39%',
    'dashboard.this_week': '本周',
    'dashboard.this_week_sub': 'XP 入账',
    'dashboard.rank': '段位',
    'dashboard.rank_sub': '宿舍排行榜',

    // Page titles
    'sports.section': '§ 02 · 运动',
    'sports.title': '运动 — 26 项选择',
    'workout.section': '§ 03 · 打卡',
    'workout.title': '打卡 — 快速登记 / 真实计时',
    'loot.section': '§ 04 · 抽卡',
    'loot.title': '抽卡 — 1.5 秒洗牌',
    'arena.section': '§ 05 · 对战',
    'arena.title': '对战 — 战斗 / 胜利 / 败北',
    'library.section': '§ 06 · 卡库',
    'library.title': '卡库 — 47 / 120',
    'deck.section': '§ 07 · 卡组',
    'deck.title': '卡组 — 主卡组 8 张 + 智能助手',
    'onboarding.section': '§ 00 · 引导',
    'onboarding.title': '引导 — 5 步流程',

    // Placeholder
    'placeholder.day': 'Day {n} 实现',
    'placeholder.day_advisor': 'Day 12 实现（含完整 advisor）',
  },
  en: {
    // Brand / nav
    'nav.tagline': 'v0.1 · Demo',
    'nav.dashboard': 'Dashboard',
    'nav.sports': 'Sports',
    'nav.workout': 'Workout',
    'nav.loot': 'Loot',
    'nav.arena': 'Arena',
    'nav.library': 'Library',
    'nav.deck': 'Deck',

    // Dashboard
    'dashboard.section': '§ 01 · Dashboard',
    'dashboard.welcome': 'Welcome back, {name}',
    'dashboard.streak_label': 'Day {n} Streak',
    'dashboard.streak_sub': '↑ next reward at day 50 · 4s breathing · hero glow',
    'dashboard.total_cards': 'Total Cards',
    'dashboard.total_cards_sub': 'of 120 · 39%',
    'dashboard.this_week': 'This Week',
    'dashboard.this_week_sub': 'XP gained',
    'dashboard.rank': 'Rank',
    'dashboard.rank_sub': 'dorm leaderboard',

    // Page titles
    'sports.section': '§ 02 · Sports',
    'sports.title': 'Sports — 26 events to choose',
    'workout.section': '§ 03 · Workout',
    'workout.title': 'Workout — Quick log / Real timer',
    'loot.section': '§ 04 · Loot',
    'loot.title': 'Loot — 1.5s shuffle',
    'arena.section': '§ 05 · Arena',
    'arena.title': 'Arena — Battle / Victory / Defeat',
    'library.section': '§ 06 · Card Library',
    'library.title': 'Library — 47 / 120',
    'deck.section': '§ 07 · Deck Builder',
    'deck.title': 'Deck — 8 main cards + advisor',
    'onboarding.section': '§ 00 · Onboarding',
    'onboarding.title': 'Onboarding — 5 step guide',

    // Placeholder
    'placeholder.day': 'Day {n} implementation',
    'placeholder.day_advisor': 'Day 12 implementation (full advisor)',
  },
} as const satisfies Record<'zh' | 'en', Record<string, string>>

export type TranslationKey = keyof typeof dict.zh

export function useTranslation() {
  const lang = useUIStore((s) => s.lang)
  const toggleLang = useUIStore((s) => s.toggleLang)

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let str: string = dict[lang][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return { t, lang, toggleLang }
}
