import { IconLock, IconCheck } from '@tabler/icons-react'
import * as TablerIcons from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClaimAchievement, type AchievementItem } from '@/api/achievements'

interface Props {
  achievement: AchievementItem
}

type IconCmp = React.ComponentType<{ size?: number; className?: string }>

export function AchievementRow({ achievement: a }: Props) {
  const { t, lang } = useTranslation()
  const claim = useClaimAchievement()

  const Icon = ((TablerIcons as unknown as Record<string, IconCmp>)[a.icon] ?? IconLock) as IconCmp
  const progress = Math.min(100, Math.round((a.current / a.target) * 100))
  const isUnlocked = !!a.unlocked_at
  const isClaimed = !!a.claimed_at
  const isClaimable = isUnlocked && !isClaimed

  const rewardLabel = (() => {
    if (a.reward_kind === 'xp') return `+${(a.reward_payload as { xp?: number }).xp ?? 0} XP`
    if (a.reward_kind === 'protect') return t('achievements.reward.protect')
    if (a.reward_kind === 'card') return t('achievements.reward.card')
    return t('achievements.reward.badge_only')
  })()

  return (
    <div
      className={
        'rounded-card border p-4 transition-colors ' +
        (isClaimed
          ? 'border-white/10 bg-bg-secondary/40 opacity-60'
          : isClaimable
          ? 'border-accent-primary bg-bg-secondary shadow-glow-standard'
          : 'border-white/10 bg-bg-secondary')
      }
    >
      <div className="flex items-center gap-4">
        <div
          className={
            'p-2 rounded-button flex-shrink-0 ' +
            (isUnlocked ? 'bg-accent-primary/20 text-accent-primary' : 'bg-bg-tertiary text-text-tertiary')
          }
        >
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-display font-bold text-base text-text-primary truncate">
              {lang === 'zh' ? a.name_zh : a.name_en}
            </div>
            {isClaimed && <IconCheck size={16} className="text-text-tertiary flex-shrink-0" />}
          </div>
          <div className="font-body text-xs text-text-secondary mb-2">
            {lang === 'zh' ? a.description_zh : a.description_en}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={'h-full transition-all ' + (isUnlocked ? 'bg-accent-primary' : 'bg-text-tertiary/50')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-text-tertiary tabular-nums w-16 text-right">
              {a.current}/{a.target}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div
            className={
              'font-mono text-xs uppercase tracking-widest ' +
              (isUnlocked ? 'text-accent-primary' : 'text-text-tertiary')
            }
          >
            {rewardLabel}
          </div>
          {isClaimable && (
            <button
              onClick={() => claim.mutate(a.id)}
              disabled={claim.isPending}
              className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider text-xs py-1.5 px-4 rounded-button shadow-glow-standard hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {t('achievements.claim_button')}
            </button>
          )}
          {isClaimed && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
              {t('achievements.claimed_label')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
