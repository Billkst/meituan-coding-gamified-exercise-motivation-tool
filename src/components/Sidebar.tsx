import { NavLink } from 'react-router-dom'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { useDevStore } from '@/store/useDevStore'

const NAV: { to: string; key: TranslationKey; icon: string }[] = [
  { to: '/dashboard', key: 'nav.dashboard', icon: 'ti-layout-dashboard' },
  { to: '/sports', key: 'nav.sports', icon: 'ti-ball-basketball' },
  { to: '/workout', key: 'nav.workout', icon: 'ti-stopwatch' },
  { to: '/loot', key: 'nav.loot', icon: 'ti-cards' },
  { to: '/arena', key: 'nav.arena', icon: 'ti-swords' },
  { to: '/library', key: 'nav.library', icon: 'ti-books' },
  { to: '/deck', key: 'nav.deck', icon: 'ti-layout-grid' },
  { to: '/achievements', key: 'nav.achievements', icon: 'ti-trophy' },
  { to: '/stats', key: 'nav.stats', icon: 'ti-chart-bar' },
  { to: '/leaderboard', key: 'nav.leaderboard', icon: 'ti-medal' },
]

export default function Sidebar() {
  const { t, lang, toggleLang } = useTranslation()
  const { isDevMode, togglePanel } = useDevStore()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-bg-secondary border-r border-white/10 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-8 border-b border-white/10">
        <div className="font-display font-black text-2xl tracking-tight uppercase text-accent-primary">
          PULSE
        </div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary mt-1">
          {t('nav.tagline')}
        </div>
      </div>

      {isDevMode && (
        <button
          onClick={togglePanel}
          className="mx-4 mt-3 mb-1 self-start bg-semantic-error text-white font-display font-bold uppercase tracking-wider px-3 py-1 rounded text-xs hover:opacity-80"
        >
          DEV
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm font-medium uppercase tracking-wider transition-colors duration-150 ease-enter ${
                isActive
                  ? 'text-accent-primary bg-bg-tertiary border-l-2 border-accent-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`
            }
          >
            <i className={`ti ${item.icon} text-lg`} />
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      {/* Language toggle */}
      <div className="px-6 py-5 border-t border-white/10">
        <button
          onClick={toggleLang}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-button border border-white/10 hover:border-accent-primary transition-colors duration-150 ease-enter font-mono text-xs uppercase tracking-widest"
          aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
        >
          <span
            className={
              lang === 'zh' ? 'text-accent-primary font-bold' : 'text-text-tertiary'
            }
          >
            中
          </span>
          <span className="text-text-tertiary">/</span>
          <span
            className={
              lang === 'en' ? 'text-accent-primary font-bold' : 'text-text-tertiary'
            }
          >
            EN
          </span>
        </button>
      </div>
    </aside>
  )
}
