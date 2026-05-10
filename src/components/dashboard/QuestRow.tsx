import { IconCheck, IconCircle } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClaimQuest, type QuestItem } from '@/api/quests'

interface Props {
  quest: QuestItem
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-rarity-common',
  medium: 'text-rarity-rare',
  hard: 'text-rarity-epic',
}

export function QuestRow({ quest: q }: Props) {
  const { t, lang } = useTranslation()
  const claim = useClaimQuest()

  const isCompleted = !!q.completed_at
  const isClaimed = !!q.claimed_at

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-shrink-0">
        {isCompleted ? (
          <IconCheck size={16} className="text-accent-primary" />
        ) : (
          <IconCircle size={16} className="text-text-tertiary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-body text-sm text-text-primary">
          {lang === 'zh' ? q.description_zh : q.description_en}
        </div>
        {!isCompleted && q.target > 1 && (
          <div className="font-mono text-[10px] text-text-tertiary tabular-nums mt-0.5">
            {q.current} / {q.target}
          </div>
        )}
      </div>
      <div
        className={
          'font-mono text-xs uppercase tracking-widest ' + (DIFFICULTY_COLOR[q.difficulty] ?? '')
        }
      >
        +{q.reward_xp} XP
      </div>
      {isCompleted && !isClaimed && (
        <button
          onClick={() => claim.mutate({ slot: q.slot })}
          disabled={claim.isPending}
          className="bg-accent-primary text-bg-primary font-mono text-[10px] uppercase tracking-widest py-1 px-3 rounded-button hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          {t('dashboard.daily_quests.claim_button')}
        </button>
      )}
      {isClaimed && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('dashboard.daily_quests.claimed_label')}
        </span>
      )}
    </div>
  )
}
