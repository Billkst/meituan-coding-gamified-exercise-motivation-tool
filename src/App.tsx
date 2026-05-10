import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initAuth } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { useDevStore } from '@/store/useDevStore'
import { useTranslation } from '@/lib/i18n'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Sports from './pages/Sports'
import Workout from './pages/Workout'
import Loot from './pages/Loot'
import Arena from './pages/Arena'
import ArenaBattle from './pages/ArenaBattle'
import ArenaResult from './pages/ArenaResult'
import CardLibrary from './pages/CardLibrary'
import DeckBuilder from './pages/DeckBuilder'
import Achievements from './pages/Achievements'
import Stats from './pages/Stats'
import Leaderboard from './pages/Leaderboard'
import Onboarding from './pages/Onboarding'
import DevDrawer from './components/DevDrawer'
import OnboardingGate from './components/OnboardingGate'

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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sports" element={<Sports />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/loot" element={<Loot />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/arena/battle/:battleId" element={<ArenaBattle />} />
            <Route path="/arena/result/:battleId" element={<ArenaResult />} />
            <Route path="/library" element={<CardLibrary />} />
            <Route path="/deck" element={<DeckBuilder />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
          </Routes>
        </OnboardingGate>
      </main>
      <DevDrawer />
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
