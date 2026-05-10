import { Link } from 'react-router-dom'
import {
  IconArrowRight,
  IconBarbell,
  IconCards,
  IconLayoutDashboard,
  IconSwords,
  IconUsers,
  IconChecklist,
  IconTrophy,
  type Icon,
} from '@tabler/icons-react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { useNbaState, pickNbaStage, type NbaStage } from '@/api/nba'

interface StageConfig {
  icon: Icon
  to: string
  titleKey: TranslationKey
  bodyKey: TranslationKey
  ctaKey: TranslationKey
  showRemainingCards?: boolean
}

const STAGE: Record<NbaStage, StageConfig> = {
  first_workout: {
    icon: IconBarbell,
    to: '/workout',
    titleKey: 'nba.first_workout.title',
    bodyKey: 'nba.first_workout.body',
    ctaKey: 'nba.first_workout.cta',
  },
  collect_cards: {
    icon: IconCards,
    to: '/workout',
    titleKey: 'nba.collect_cards.title',
    bodyKey: 'nba.collect_cards.body',
    ctaKey: 'nba.collect_cards.cta',
    showRemainingCards: true,
  },
  build_deck: {
    icon: IconLayoutDashboard,
    to: '/deck',
    titleKey: 'nba.build_deck.title',
    bodyKey: 'nba.build_deck.body',
    ctaKey: 'nba.build_deck.cta',
  },
  first_pve: {
    icon: IconSwords,
    to: '/arena',
    titleKey: 'nba.first_pve.title',
    bodyKey: 'nba.first_pve.body',
    ctaKey: 'nba.first_pve.cta',
  },
  first_friend: {
    icon: IconUsers,
    to: '/leaderboard',
    titleKey: 'nba.first_friend.title',
    bodyKey: 'nba.first_friend.body',
    ctaKey: 'nba.first_friend.cta',
  },
  daily_quests: {
    icon: IconChecklist,
    to: '/dashboard',
    titleKey: 'nba.daily_quests.title',
    bodyKey: 'nba.daily_quests.body',
    ctaKey: 'nba.daily_quests.cta',
  },
  done: {
    icon: IconTrophy,
    to: '/leaderboard',
    titleKey: 'nba.done.title',
    bodyKey: 'nba.done.body',
    ctaKey: 'nba.done.cta',
  },
}

export default function NextBestActionCard() {
  const { t } = useTranslation()
  const { data: nba, isLoading } = useNbaState()
  const stage = pickNbaStage(nba)

  if (isLoading || !stage) return null

  const cfg = STAGE[stage]
  const Ico = cfg.icon
  const remainingCards = cfg.showRemainingCards && nba
    ? Math.max(0, 8 - nba.owned_cards_count)
    : null
  const body = remainingCards != null
    ? t(cfg.bodyKey, { n: remainingCards })
    : t(cfg.bodyKey)

  return (
    <section className="bg-bg-secondary border border-accent-primary/30 rounded-card px-5 md:px-6 py-5 mb-8 shadow-glow-subtle relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(circle at top right, rgba(182,255,60,0.15), transparent 60%)',
        }}
      />
      <div className="relative flex items-center gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-card bg-accent-primary/15 border border-accent-primary/40 flex items-center justify-center">
          <Ico size={20} className="text-accent-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-1">
            {t('nba.label')}
          </div>
          <div className="font-display font-bold text-lg md:text-xl truncate">
            {t(cfg.titleKey)}
          </div>
          <div className="font-body text-xs md:text-sm text-text-secondary mt-1 leading-snug">
            {body}
          </div>
        </div>
        <Link
          to={cfg.to}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-3 md:px-4 rounded-button text-xs md:text-sm shadow-glow-subtle hover:shadow-glow-standard hover:scale-[1.02] transition-all duration-150 ease-enter"
        >
          {t(cfg.ctaKey)}
          <IconArrowRight size={14} />
        </Link>
      </div>
    </section>
  )
}
