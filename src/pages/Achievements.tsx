import { useTranslation } from '@/lib/i18n'
import { useAchievements } from '@/api/achievements'
import { AchievementCategorySection } from '@/components/achievements/AchievementCategorySection'
import type { AchievementCategory } from '@/types/db'

const CATEGORY_ORDER: AchievementCategory[] = ['workout', 'streak', 'cards', 'arena', 'special']

export default function Achievements() {
  const { t } = useTranslation()
  const { data, isLoading } = useAchievements()

  if (isLoading) {
    return (
      <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="font-mono text-sm text-text-tertiary">{t('achievements.loading')}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('achievements.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-2">
        {t('achievements.title')}
      </h1>
      <div className="font-mono text-sm text-text-secondary mb-12 tabular-nums">
        {data.summary.unlocked} / {data.summary.total} {t('achievements.summary_suffix')}
        {data.summary.claimable > 0 && (
          <span className="ml-4 text-accent-primary">
            · {data.summary.claimable} {t('achievements.claimable_suffix')}
          </span>
        )}
      </div>
      <div className="space-y-12">
        {[...data.categories]
          .sort((a, b) => CATEGORY_ORDER.indexOf(a.key) - CATEGORY_ORDER.indexOf(b.key))
          .map((cat) => (
            <AchievementCategorySection
              key={cat.key}
              categoryKey={cat.key}
              achievements={cat.achievements}
            />
          ))}
      </div>
    </div>
  )
}
