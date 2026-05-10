import { useTranslation, type TranslationKey } from '@/lib/i18n'
import type { AchievementCategory } from '@/types/db'
import { AchievementRow } from './AchievementRow'
import type { AchievementItem } from '@/api/achievements'

interface Props {
  categoryKey: AchievementCategory
  achievements: AchievementItem[]
}

export function AchievementCategorySection({ categoryKey, achievements }: Props) {
  const { t } = useTranslation()
  const unlocked = achievements.filter((a) => a.unlocked_at).length
  const labelKey = `achievements.category.${categoryKey}` as TranslationKey

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 border-b border-white/10 pb-2">
        <h2 className="font-display font-bold text-lg uppercase tracking-tight">{t(labelKey)}</h2>
        <div className="font-mono text-xs text-text-tertiary tabular-nums">
          {unlocked} / {achievements.length}
        </div>
      </div>
      <div className="space-y-3">
        {achievements.map((a) => (
          <AchievementRow key={a.id} achievement={a} />
        ))}
      </div>
    </section>
  )
}
