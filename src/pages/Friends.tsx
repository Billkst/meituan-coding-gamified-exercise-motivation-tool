import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { useFriendsList } from '@/api/friends'
import { FriendCard } from '@/components/friends/FriendCard'
import { InviteRow } from '@/components/friends/InviteRow'

type Tab = 'active' | 'incoming' | 'outgoing'

export default function Friends() {
  const { t } = useTranslation()
  const { data, isLoading } = useFriendsList()
  const [tab, setTab] = useState<Tab>('active')

  const counts = {
    active: data?.active.length ?? 0,
    incoming: data?.incoming.length ?? 0,
    outgoing: data?.outgoing.length ?? 0,
  }

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('friends.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t('friends.title')}
      </h1>

      <div className="flex items-center gap-2 mb-6">
        {(['active', 'incoming', 'outgoing'] as Tab[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setTab(p)}
            className={
              'font-mono text-xs uppercase tracking-widest py-2 px-4 rounded-button transition-colors flex items-center gap-2 ' +
              (p === tab
                ? 'bg-accent-primary text-bg-primary'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary')
            }
          >
            {t(`friends.tabs.${p}` as TranslationKey)}
            <span className="tabular-nums opacity-70">{counts[p]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="font-mono text-sm text-text-tertiary">{t('friends.loading')}</div>
      ) : !data ? null : (
        <div className="space-y-2">
          {tab === 'active' &&
            (data.active.length === 0 ? (
              <EmptyState
                title={t('friends.empty.active.title')}
                hint={t('friends.empty.active.hint')}
              />
            ) : (
              data.active.map((f) => <FriendCard key={f.user_id} friend={f} />)
            ))}

          {tab === 'incoming' &&
            (data.incoming.length === 0 ? (
              <EmptyState
                title={t('friends.empty.incoming.title')}
                hint={t('friends.empty.incoming.hint')}
              />
            ) : (
              data.incoming.map((u) => (
                <InviteRow key={u.user_id} user={u} direction="incoming" />
              ))
            ))}

          {tab === 'outgoing' &&
            (data.outgoing.length === 0 ? (
              <EmptyState
                title={t('friends.empty.outgoing.title')}
                hint={t('friends.empty.outgoing.hint')}
              />
            ) : (
              data.outgoing.map((u) => (
                <InviteRow key={u.user_id} user={u} direction="outgoing" />
              ))
            ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  const { t } = useTranslation()
  return (
    <div className="bg-bg-secondary border border-dashed border-white/10 rounded-card p-8 text-center">
      <div className="font-display font-bold text-lg mb-2">{title}</div>
      <p className="font-mono text-xs text-text-tertiary uppercase tracking-widest mb-4">
        {hint}
      </p>
      <Link
        to="/leaderboard"
        className="inline-block font-mono text-xs uppercase tracking-widest text-accent-primary hover:underline"
      >
        → {t('friends.empty.cta_leaderboard')}
      </Link>
    </div>
  )
}
