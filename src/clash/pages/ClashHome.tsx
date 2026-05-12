// Clash main menu: gold/streak chip, big battle CTA, chest queue, deck/cards/chests links.

import { Link, useNavigate } from 'react-router-dom'
import { IconSwords, IconCoins, IconChevronRight } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useClashState } from '@/clash/api/clashState'
import { useOpenChest, useUnlockChestNow } from '@/clash/api/clashChests'
import { useDevStore } from '@/store/useDevStore'
import { useEffect, useState } from 'react'
import NextBestActionClash from '@/clash/components/NextBestActionClash'
import SpotlightTour, { type TourStep } from '@/components/SpotlightTour'

const HOME_TOUR_KEY = 'pulse.clash.home.tour_seen'
const HOME_TOUR_STEPS: TourStep[] = [
  { titleKey: 'clash.home.tour.welcome.title', bodyKey: 'clash.home.tour.welcome.body' },
  { target: 'clash.home.nba', titleKey: 'clash.home.tour.nba.title', bodyKey: 'clash.home.tour.nba.body' },
  { target: 'clash.home.battle', titleKey: 'clash.home.tour.battle.title', bodyKey: 'clash.home.tour.battle.body' },
  { target: 'clash.home.chests', titleKey: 'clash.home.tour.chests.title', bodyKey: 'clash.home.tour.chests.body' },
]

export default function ClashHome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: state, isLoading, error } = useClashState()
  const openChest = useOpenChest()
  const unlockNow = useUnlockChestNow()
  const isDev = useDevStore((s) => s.isDevMode)
  const [openedRewards, setOpenedRewards] = useState<{ gold: number; shards: number } | null>(null)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(HOME_TOUR_KEY)) return
    // Suppress for v2-onboarded users — they already walked through 4 onboarding
    // steps + 4 in-tutorial popups. A third 4-step tour here is the "19-popup
    // overload" the QA report flagged.
    if (window.localStorage.getItem('pulse.onboarding.completed_v2') === '1') {
      window.localStorage.setItem(HOME_TOUR_KEY, '1')
      return
    }
    setShowTour(true)
  }, [])

  const dismissTour = () => {
    window.localStorage.setItem(HOME_TOUR_KEY, '1')
    setShowTour(false)
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest text-text-secondary animate-pulse">loading clash…</div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-3">
        <div className="font-display font-bold text-xl text-semantic-error">Clash 数据未就绪</div>
        <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary text-center">
          后端 migrations 24-27 尚未 push。<br />
          按 CLAUDE.md 的 pooler URL 套路推一下即可。
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary hover:text-text-primary"
        >
          ← 返回主页
        </button>
      </div>
    )
  }

  if (!state) return null

  const readyChests = state.chests.filter((c) => new Date(c.unlocks_at) <= new Date())
  const lockedChests = state.chests.filter((c) => new Date(c.unlocks_at) > new Date())

  const handleOpenChest = (id: string) => {
    openChest.mutate(id, {
      onSuccess: (r) => {
        setOpenedRewards({ gold: r.gold, shards: r.shards })
        window.setTimeout(() => setOpenedRewards(null), 3000)
      },
    })
  }

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 pl-14 md:pl-8 py-8 md:py-12">
      {/* Brand header */}
      <header className="mb-8">
        <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
          {t('clash.brand' as never)}
        </div>
        <h1 className="font-display font-bold text-3xl uppercase tracking-tight">
          {t('clash.tagline' as never)}
        </h1>
        <div className="font-mono text-xs text-text-tertiary mt-1">
          {t('clash.home.subtitle' as never)}
        </div>
      </header>

      {/* Next-best-action — surfaces the workout-to-cards-to-battle loop */}
      <div data-tour="clash.home.nba">
        <NextBestActionClash state={state} />
      </div>

      {/* Currency strip */}
      <section className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-bg-secondary border border-white/10 rounded-card px-4 py-3 flex items-center gap-2">
          <IconCoins size={18} className="text-rarity-legendary" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
              {t('clash.home.gold' as never)}
            </div>
            <div className="font-display text-xl font-bold tabular-nums">{state.gold}</div>
          </div>
        </div>
        <div className="bg-bg-secondary border border-white/10 rounded-card px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
            {t('clash.home.shards' as never)}
          </div>
          <div className="font-display text-xl font-bold tabular-nums">{state.shards_total}</div>
        </div>
        {state.win_streak > 0 && (
          <div className="bg-accent-primary/10 border border-accent-primary/40 rounded-card px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary">
              streak
            </div>
            <div className="font-display text-xl font-bold tabular-nums text-accent-primary">
              {state.win_streak}
            </div>
          </div>
        )}
      </section>

      {/* Battle CTA */}
      <section className="text-center mb-8">
        <button
          data-tour="clash.home.battle"
          onClick={() => navigate('/clash/match')}
          className="inline-flex items-center gap-3 bg-accent-primary text-bg-primary font-display font-black uppercase tracking-wider py-4 px-12 rounded-button shadow-glow-hero hover:scale-[1.02] transition-all duration-150 ease-enter text-xl"
        >
          <IconSwords size={24} />
          {t('clash.home.battle_cta' as never)}
        </button>
      </section>

      {/* Sub-nav: cards / deck / chests */}
      <section className="grid grid-cols-3 gap-3 mb-4">
        <NavTile to="/clash/cards" label={t('clash.home.cards' as never)} emoji="🃏" />
        <NavTile to="/clash/deck" label={t('clash.home.deck' as never)} emoji="📋" />
        <NavTile to="/clash/chests" label={t('clash.home.chests' as never)} emoji="📦" />
      </section>

      {/* Replay tutorial link */}
      <div className="text-center mb-8">
        <button
          onClick={() => {
            window.localStorage.removeItem('pulse.onboarding.completed_v2')
            navigate('/clash/match?tutorial=1')
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary hover:text-accent-primary underline"
        >
          {t('clash.home.replay_tutorial' as never)}
        </button>
      </div>

      {/* Chest queue */}
      <section data-tour="clash.home.chests" className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mb-3">
          {t('clash.chests.title' as never)} · {state.chests.length}/4
        </div>
        {state.chests.length === 0 ? (
          <div className="font-mono text-xs text-text-tertiary text-center py-6 border border-dashed border-white/10 rounded-card">
            {t('clash.home.no_chests' as never)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {readyChests.map((c) => (
              <button
                key={c.id}
                onClick={() => handleOpenChest(c.id)}
                disabled={openChest.isPending}
                className="bg-accent-primary/15 border-2 border-accent-primary rounded-card p-3 flex items-center gap-3 hover:scale-[1.02] transition-all animate-pulse disabled:opacity-50"
              >
                <span className="text-2xl">{c.chest_type === 'gold' ? '🟡' : '⚪'}</span>
                <div className="text-left">
                  <div className="font-display font-bold text-sm uppercase">
                    {t(`clash.chests.${c.chest_type}` as never)}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary">
                    {t('clash.chests.ready' as never)}
                  </div>
                </div>
              </button>
            ))}
            {lockedChests.map((c) => (
              <div
                key={c.id}
                className="bg-bg-secondary border border-white/10 rounded-card p-3 flex items-center gap-3"
              >
                <span className="text-2xl opacity-50">{c.chest_type === 'gold' ? '🟡' : '⚪'}</span>
                <div className="flex-1">
                  <div className="font-display font-bold text-sm uppercase text-text-secondary">
                    {t(`clash.chests.${c.chest_type}` as never)}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
                    {t('clash.chests.unlocks_in' as never)}{' '}
                    {fmtRemaining(new Date(c.unlocks_at).getTime() - Date.now())}
                  </div>
                </div>
                {isDev && (
                  <button
                    onClick={() => unlockNow.mutate(c.id)}
                    className="font-mono text-[9px] uppercase tracking-widest text-accent-primary hover:underline"
                  >
                    DEV ⚡
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reward toast */}
      {openedRewards && (
        <div className="fixed top-6 right-6 bg-accent-primary text-bg-primary font-display font-bold uppercase px-4 py-3 rounded-card shadow-glow-standard">
          +{openedRewards.gold} 💰 · +{openedRewards.shards} 💎
        </div>
      )}

      {/* First-time spotlight tour */}
      <SpotlightTour steps={HOME_TOUR_STEPS} open={showTour} onClose={dismissTour} />
    </div>
  )
}

function NavTile({ to, label, emoji }: { to: string; label: string; emoji: string }) {
  return (
    <Link
      to={to}
      className="bg-bg-secondary border border-white/10 rounded-card p-4 flex flex-col items-center gap-2 hover:border-accent-primary/50 hover:bg-bg-secondary/60 transition-colors group"
    >
      <span className="text-3xl">{emoji}</span>
      <span className="font-display font-bold text-sm uppercase tracking-tight">{label}</span>
      <IconChevronRight size={14} className="text-text-tertiary group-hover:text-accent-primary" />
    </Link>
  )
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}
