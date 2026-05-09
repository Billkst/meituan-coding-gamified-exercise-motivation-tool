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
    'dashboard.streak_label': '连续天数',
    'dashboard.streak_sub': '↑ 下一个里程碑 · 第 50 天',
    'dashboard.total_cards': '总卡牌',
    'dashboard.total_cards_sub': '共 120 张 · 39%',
    'dashboard.this_week': '本周',
    'dashboard.this_week_sub': 'XP 入账',
    'dashboard.rank': '段位',
    'dashboard.rank_sub': '宿舍排行榜',

    // Page titles
    'sports.section': '§ 02 · 运动',
    'sports.title': '运动 — 26 项选择',
    'sports.cat.cardio': '有氧',
    'sports.cat.strength': '力量',
    'sports.cat.ball': '球类',
    'sports.cat.flex': '柔韧',
    'sports.cat.martial': '格斗',
    'sports.cat.outdoor': '户外',
    'sports.loading': '加载 26 项运动中…',
    'sports.error': '加载失败：{msg}',
    'sports.retry': '重试',
    'sports.empty': '没数据。检查 Supabase 是否 seed 过。',

    // Auth
    'auth.initializing': '正在以匿名身份登录…',
    'auth.error': '登录失败：{msg}',

    // Dashboard data
    'dashboard.zero_streak': '开始你的第一次训练 →',
    'dashboard.username': '@{name}',

    // Workout fields
    'workout.field.sport': '运动项目',
    'workout.field.duration': '时长 · {n} 分钟',
    'workout.field.intensity': '强度',
    'workout.intensity.light': '轻松',
    'workout.intensity.medium': '中等',
    'workout.intensity.high': '高强度',
    'workout.submit': '完成训练',
    'workout.submitting': '提交中…',
    'workout.error': '提交失败：{msg}',
    'workout.result': '本次结果',
    'workout.streak_now': '当前 streak {n} 天',
    'workout.streak_new': '新 streak 开启',
    'workout.streak_continued': 'streak 延续',
    'workout.streak_same_day': '同日训练，streak 不变',
    'workout.card_drawn': '抽到一张',
    'workout.xp_gained': '+{n} XP',
    'workout.section': '§ 03 · 打卡',
    'workout.title': '打卡 — 快速登记 / 真实计时',
    'loot.section': '§ 04 · 抽卡',
    'loot.title': '抽卡',
    'loot.shuffling_title': '正在抽卡',
    'loot.reveal_title': '今日掉落',
    'loot.shuffling': '洗牌中…',
    'loot.continue': '继续',
    'loot.empty': '暂无最近抽卡。完成一次训练，立刻抽 1 张卡。',
    'loot.go_workout': '→ 去打卡',
    'arena.section': '§ 05 · 对战',
    'arena.title': '对战 — 战斗 / 胜利 / 败北',
    'library.section': '§ 06 · 卡库',
    'library.title': '卡库',
    'library.title_n': '卡库 — {n} / {total}',
    'library.cards_unit': '张',
    'library.locked': '未解锁 · 继续打卡探索',
    'library.loading': '加载卡库…',
    'library.maxed': '★5 已封顶',
    'library.upgrade': '升星 · 消耗 {cost}',
    'library.upgrading': '升星中…',
    'library.need': '还差 {cost} 张',
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
    'dashboard.streak_label': 'DAY STREAK',
    'dashboard.streak_sub': '↑ next milestone · day 50',
    'dashboard.total_cards': 'Total Cards',
    'dashboard.total_cards_sub': 'of 120 · 39%',
    'dashboard.this_week': 'This Week',
    'dashboard.this_week_sub': 'XP gained',
    'dashboard.rank': 'Rank',
    'dashboard.rank_sub': 'dorm leaderboard',

    // Page titles
    'sports.section': '§ 02 · Sports',
    'sports.title': 'Sports — 26 events to choose',
    'sports.cat.cardio': 'Cardio',
    'sports.cat.strength': 'Strength',
    'sports.cat.ball': 'Ball',
    'sports.cat.flex': 'Flex',
    'sports.cat.martial': 'Martial',
    'sports.cat.outdoor': 'Outdoor',
    'sports.loading': 'Loading 26 sports…',
    'sports.error': 'Load failed: {msg}',
    'sports.retry': 'Retry',
    'sports.empty': 'No data. Check Supabase seed.',

    // Auth
    'auth.initializing': 'Signing in anonymously…',
    'auth.error': 'Sign in failed: {msg}',

    // Dashboard data
    'dashboard.zero_streak': 'Start your first workout →',
    'dashboard.username': '@{name}',

    // Workout fields
    'workout.field.sport': 'Sport',
    'workout.field.duration': 'Duration · {n} min',
    'workout.field.intensity': 'Intensity',
    'workout.intensity.light': 'Light',
    'workout.intensity.medium': 'Medium',
    'workout.intensity.high': 'High',
    'workout.submit': 'Submit workout',
    'workout.submitting': 'Submitting…',
    'workout.error': 'Submit failed: {msg}',
    'workout.result': 'Result',
    'workout.streak_now': 'Streak {n} days',
    'workout.streak_new': 'new streak started',
    'workout.streak_continued': 'streak continued',
    'workout.streak_same_day': 'same day, streak unchanged',
    'workout.card_drawn': 'Drew',
    'workout.xp_gained': '+{n} XP',
    'workout.section': '§ 03 · Workout',
    'workout.title': 'Workout — Quick log / Real timer',
    'loot.section': '§ 04 · Loot',
    'loot.title': 'Loot',
    'loot.shuffling_title': 'DRAWING',
    'loot.reveal_title': 'TODAY DROPPED',
    'loot.shuffling': 'SHUFFLING…',
    'loot.continue': 'CONTINUE',
    'loot.empty': 'No recent loot. Finish a workout to draw a card.',
    'loot.go_workout': '→ Workout',
    'arena.section': '§ 05 · Arena',
    'arena.title': 'Arena — Battle / Victory / Defeat',
    'library.section': '§ 06 · Card Library',
    'library.title': 'Library',
    'library.title_n': 'Library — {n} / {total}',
    'library.cards_unit': 'cards',
    'library.locked': 'Locked · keep training',
    'library.loading': 'Loading library…',
    'library.maxed': 'MAX ★5',
    'library.upgrade': 'UPGRADE · {cost}',
    'library.upgrading': 'UPGRADING…',
    'library.need': 'need {cost} more',
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
