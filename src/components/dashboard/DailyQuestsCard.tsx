import { useTranslation } from '@/lib/i18n'
import { useDailyQuests } from '@/api/quests'
import { QuestRow } from './QuestRow'
import { QuestBonusRow } from './QuestBonusRow'

export function DailyQuestsCard() {
  const { t } = useTranslation()
  const { data, isLoading } = useDailyQuests()

  if (isLoading || !data) {
    return (
      <div className="bg-bg-secondary border border-white/10 rounded-card p-6 mb-8">
        <div className="font-mono text-xs text-text-tertiary">
          {t('dashboard.daily_quests.loading')}
        </div>
      </div>
    )
  }

  if (data.quests.length === 0) return null

  const completed = data.quests.filter((q) => q.completed_at).length
  const allClaimed = data.quests.every((q) => q.claimed_at)

  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card p-6 mb-8">
      <div className="flex items-baseline justify-between mb-4 border-b border-white/10 pb-3">
        <h2 className="font-display font-bold text-lg uppercase tracking-tight">
          {t('dashboard.daily_quests.title')}
        </h2>
        <div className="font-mono text-xs text-text-tertiary tabular-nums">
          {completed} / {data.quests.length} {t('dashboard.daily_quests.completed_label')}
        </div>
      </div>
      <div className="space-y-2">
        {data.quests.map((q) => (
          <QuestRow key={q.slot} quest={q} />
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/10">
        <QuestBonusRow allClaimed={allClaimed} bonusClaimed={data.all_completed_bonus_claimed} />
      </div>
    </div>
  )
}
