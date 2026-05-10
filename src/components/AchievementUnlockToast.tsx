import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { IconTrophy } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useAchievements } from '@/api/achievements'

export function AchievementUnlockToast() {
  const { t, lang } = useTranslation()
  const { data } = useAchievements()
  const seenIdsRef = useRef<Set<string> | null>(null)
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!data) return

    const allUnlocked = data.categories.flatMap((c) =>
      c.achievements.filter((a) => a.unlocked_at && !a.claimed_at),
    )

    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(allUnlocked.map((a) => a.id))
      return
    }

    const newly = allUnlocked.find((a) => !seenIdsRef.current!.has(a.id))
    if (newly) {
      seenIdsRef.current.add(newly.id)
      setPending({
        id: newly.id,
        name: lang === 'zh' ? newly.name_zh : newly.name_en,
      })
      const timer = setTimeout(() => setPending(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [data, lang])

  if (!pending) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-bg-secondary border border-accent-primary rounded-card px-4 py-3 shadow-glow-hero flex items-center gap-3">
      <IconTrophy size={20} className="text-accent-primary" />
      <div className="font-mono text-sm">
        <span className="text-text-tertiary uppercase tracking-widest text-xs mr-2">
          {t('toast.achievement_unlocked')}
        </span>
        <span className="text-text-primary font-display font-bold">{pending.name}</span>
      </div>
      <Link
        to="/achievements"
        className="font-mono text-xs uppercase tracking-widest text-accent-primary hover:underline ml-2"
      >
        {t('toast.achievement_unlocked_cta')} →
      </Link>
    </div>
  )
}
