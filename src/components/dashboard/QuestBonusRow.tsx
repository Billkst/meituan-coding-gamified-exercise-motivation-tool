import { IconGift } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClaimQuest } from '@/api/quests'

interface Props {
  allClaimed: boolean
  bonusClaimed: boolean
}

export function QuestBonusRow({ allClaimed, bonusClaimed }: Props) {
  const { t } = useTranslation()
  const claim = useClaimQuest()
  const ready = allClaimed && !bonusClaimed

  return (
    <div className="flex items-center gap-3 py-1">
      <IconGift size={16} className={ready ? 'text-accent-primary' : 'text-text-tertiary'} />
      <div className="flex-1 font-mono text-xs uppercase tracking-widest text-text-secondary">
        {t('dashboard.daily_quests.bonus_label')}
      </div>
      <div className="font-mono text-xs text-text-tertiary">
        +200 XP · 1 {t('dashboard.daily_quests.bonus_card')}
      </div>
      {bonusClaimed ? (
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('dashboard.daily_quests.bonus_claimed')}
        </span>
      ) : ready ? (
        <button
          onClick={() => claim.mutate({ bonus: true })}
          disabled={claim.isPending}
          className="bg-accent-primary text-bg-primary font-mono text-[10px] uppercase tracking-widest py-1 px-3 rounded-button hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          {t('dashboard.daily_quests.bonus_claim')}
        </button>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {t('dashboard.daily_quests.bonus_locked')}
        </span>
      )}
    </div>
  )
}
