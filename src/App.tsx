import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initAuth } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { useDevStore } from '@/store/useDevStore'
import { useTranslation } from '@/lib/i18n'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import Onboarding from './pages/Onboarding'
import Reset from './pages/Reset'
import Leaderboard from './pages/Leaderboard'
import DevDrawer from './components/DevDrawer'
import OnboardingGate from './components/OnboardingGate'
import ClashHome from './clash/pages/ClashHome'
import ClashMatch from './clash/pages/ClashMatch'
import ClashResult from './clash/pages/ClashResult'
import ClashCollection from './clash/pages/ClashCollection'
import TutorialResult from './clash/pages/TutorialResult'

export default function App() {
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const initError = useAuthStore((s) => s.initError)
  const { t } = useTranslation()

  useEffect(() => {
    void initAuth()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('dev') === '1') {
      useDevStore.getState().enableDevMode()
    }

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        const { isDevMode, togglePanel } = useDevStore.getState()
        if (isDevMode) togglePanel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!isInitialized) {
    return <BootScreen message={t('auth.initializing')} />
  }
  // initError used to hard-block the entire app, which made the judge
  // experience brittle (one DNS hiccup → blank screen). Now we let routes
  // render and surface the failure as a non-blocking banner so /reset and
  // local onboarding still work without server-side auth.

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-[240px]">
        {initError && (
          <div
            className="bg-semantic-error/15 border-b border-semantic-error/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-semantic-error text-center"
            role="alert"
          >
            {t('auth.error', { msg: initError })}
          </div>
        )}
        <OnboardingGate>
          <Routes>
            <Route path="/" element={<Navigate to="/clash" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/clash" element={<ClashHome />} />
            <Route path="/clash/match" element={<ClashMatch />} />
            <Route path="/clash/result" element={<ClashResult />} />
            <Route path="/clash/tutorial-result" element={<TutorialResult />} />
            <Route path="/clash/collection" element={<ClashCollection />} />
            <Route path="/clash/cards" element={<CollectionRedirect tab="cards" />} />
            <Route path="/clash/deck" element={<CollectionRedirect tab="deck" />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<Navigate to="/clash" replace />} />
          </Routes>
        </OnboardingGate>
      </main>
      <DevDrawer />
    </div>
  )
}

function CollectionRedirect({ tab }: { tab: 'cards' | 'deck' }) {
  return <Navigate to={`/clash/collection?tab=${tab}`} replace />
}

function BootScreen({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="text-center">
        <div className="font-display font-black text-4xl text-accent-primary uppercase tracking-tight mb-4">
          PULSE
        </div>
        <div
          className={
            'font-mono text-sm uppercase tracking-widest ' +
            (error ? 'text-semantic-error' : 'text-text-secondary')
          }
        >
          {message}
        </div>
      </div>
    </div>
  )
}
