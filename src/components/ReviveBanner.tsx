import { useEffect, useState } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useCurrentUser } from '@/api/users'
import { useReviveStreak } from '@/api/revive'
import { canRevive } from '@/lib/streak/revive'

type FlashState = { kind: 'success' | 'error'; msg: string } | null

export default function ReviveBanner() {
  const { t } = useTranslation()
  const { data: user } = useCurrentUser()
  const revive = useReviveStreak()
  const [flash, setFlash] = useState<FlashState>(null)

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(id)
  }, [flash])

  if (!user) return null
  const now = new Date()
  if (!canRevive({
    current_streak: user.current_streak,
    last_workout_date: user.last_workout_date,
    freeze_xp_until: user.freeze_xp_until,
  }, now) && !flash) return null

  const last = user.last_workout_date ? new Date(user.last_workout_date + 'T00:00:00Z') : now
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z')
  const days = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  const handleRevive = async () => {
    try {
      const r = await revive.mutateAsync()
      setFlash({ kind: 'success', msg: t('revive.success.toast' as never, { n: r.revived_streak } as never) as string })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      let key = 'revive.error.generic'
      if (msg.includes('already revived')) key = 'revive.error.already_revived'
      else if (msg.includes('window closed')) key = 'revive.error.window_closed'
      else if (msg.includes('too short') || msg.includes('no streak to revive')) key = 'revive.error.too_short'
      setFlash({ kind: 'error', msg: t(key as never, { msg } as never) as string })
    }
  }

  if (flash) {
    const isErr = flash.kind === 'error'
    return (
      <div className={
        'border rounded-card p-4 mb-6 flex items-center gap-4 ' +
        (isErr
          ? 'bg-semantic-error/10 border-semantic-error text-semantic-error'
          : 'bg-accent-primary/10 border-accent-primary text-accent-primary')
      }>
        <div className="flex-1 font-mono text-sm">{flash.msg}</div>
      </div>
    )
  }

  return (
    <div className="bg-semantic-error/10 border border-semantic-error rounded-card p-4 mb-6 flex items-center gap-4">
      <IconAlertTriangle className="text-semantic-error" size={32} />
      <div className="flex-1">
        <div className="font-display font-bold uppercase text-semantic-error">
          {t('revive.banner.title' as never, { days } as never)}
        </div>
        <div className="font-mono text-xs text-text-secondary mt-1">
          {t('revive.banner.subtitle' as never)}
        </div>
      </div>
      <button
        onClick={handleRevive}
        disabled={revive.isPending}
        className="bg-semantic-error text-white font-display font-bold uppercase tracking-wider px-6 py-2 rounded-button disabled:opacity-50"
      >
        {revive.isPending ? '...' : t('revive.cta' as never)}
      </button>
    </div>
  )
}
