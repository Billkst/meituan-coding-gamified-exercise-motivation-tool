import { Link } from 'react-router-dom'
import { IconSwords } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useCurrentUser, useMyCardCount } from '@/api/users'

export default function Dashboard() {
  const { t } = useTranslation()
  const { data: user, isLoading } = useCurrentUser()
  const { data: cardCount } = useMyCardCount()

  const streak = user?.current_streak ?? 0
  const xp = user?.xp ?? 0
  const username = user?.username ?? '...'

  return (
    <div className="max-w-container mx-auto px-8 py-12">
      <header className="mb-12">
        <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
          {t('dashboard.section')}
        </div>
        <h1 className="font-display font-bold text-3xl uppercase tracking-tight">
          {t('dashboard.welcome', { name: username })}
        </h1>
      </header>

      {/* Streak hero — memorable visual anchor */}
      <section className="bg-bg-secondary border border-white/10 rounded-card py-16 px-8 mb-8 text-center">
        <div className="font-mono text-base uppercase tracking-[0.1em] text-text-secondary mb-2">
          {t('dashboard.streak_label')}
        </div>
        <div
          className={
            'font-display font-black leading-none ' +
            (streak > 0
              ? 'text-accent-primary animate-breathing'
              : 'text-text-tertiary')
          }
          style={{
            fontSize: 'clamp(80px, 14vh, 180px)',
            fontVariantNumeric: 'tabular-nums',
            textShadow:
              streak > 0
                ? '0 0 24px rgba(182,255,60,0.7), 0 0 48px rgba(182,255,60,0.3)'
                : 'none',
          }}
        >
          {isLoading ? '—' : streak}
        </div>
        <div className="font-mono text-xs text-text-tertiary mt-4 uppercase tracking-wider">
          {streak > 0 ? t('dashboard.streak_sub') : t('dashboard.zero_streak')}
        </div>
      </section>

      {/* Secondary stats */}
      <section className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label={t('dashboard.total_cards')}
          value={String(cardCount ?? 0)}
          sub={t('dashboard.total_cards_sub')}
        />
        <StatCard
          label={t('dashboard.this_week')}
          value={String(xp)}
          sub={t('dashboard.this_week_sub')}
        />
        <StatCard
          label={t('dashboard.rank')}
          value={`L${user?.level ?? 1}`}
          sub={t('dashboard.rank_sub')}
        />
      </section>

      {/* Arena CTA */}
      <div className="text-center">
        <Link
          to="/arena"
          className="inline-flex items-center gap-2 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all duration-150 ease-enter"
        >
          <IconSwords size={18} />
          {t('arena.lobby.title')}
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-bg-secondary border border-white/10 rounded-card px-6 py-5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mb-2">
        {label}
      </div>
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
      <div className="font-mono text-xs text-text-secondary mt-1">{sub}</div>
    </div>
  )
}
