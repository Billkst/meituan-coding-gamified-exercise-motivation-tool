import { useEffect } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { initAuth } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { useDevStore } from '@/store/useDevStore'
import { useTranslation } from '@/lib/i18n'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import Onboarding from './pages/Onboarding'
import DevDrawer from './components/DevDrawer'
import OnboardingGate from './components/OnboardingGate'
import ClashHome from './clash/pages/ClashHome'
import ClashMatch from './clash/pages/ClashMatch'
import ClashResult from './clash/pages/ClashResult'
import ClashCollection from './clash/pages/ClashCollection'

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
  if (initError) {
    return <BootScreen message={t('auth.error', { msg: initError })} error />
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-[240px]">
        <OnboardingGate>
          <Routes>
            <Route path="/" element={<Navigate to="/clash" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/clash" element={<ClashHome />} />
            <Route path="/clash/match" element={<ClashMatch />} />
            <Route path="/clash/result" element={<ClashResult />} />
            <Route path="/clash/collection" element={<ClashCollection />} />
            <Route path="/clash/cards" element={<CollectionRedirect tab="cards" />} />
            <Route path="/clash/deck" element={<CollectionRedirect tab="deck" />} />
            <Route path="/reset" element={<ResetStub />} />
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

function ResetStub() {
  // Day 25 will replace this with real reset logic + dev_reset_user RPC.
  const [params] = useSearchParams()
  const force = params.get('force') === '1'
  useEffect(() => {
    if (!force) return
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pulse.'))
      .forEach((k) => localStorage.removeItem(k))
    window.location.replace('/onboarding?step=1')
  }, [force])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
        {force ? '重置中...' : '访问 /reset?force=1 强制重启 onboarding'}
      </div>
    </div>
  )
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
