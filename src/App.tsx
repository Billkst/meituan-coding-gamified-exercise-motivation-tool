import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initAuth } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/lib/i18n'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Sports from './pages/Sports'
import Workout from './pages/Workout'
import Loot from './pages/Loot'
import Arena from './pages/Arena'
import CardLibrary from './pages/CardLibrary'
import DeckBuilder from './pages/DeckBuilder'
import Onboarding from './pages/Onboarding'

export default function App() {
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const initError = useAuthStore((s) => s.initError)
  const { t } = useTranslation()

  useEffect(() => {
    void initAuth()
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
      <main className="flex-1 ml-[240px]">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sports" element={<Sports />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/loot" element={<Loot />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/library" element={<CardLibrary />} />
          <Route path="/deck" element={<DeckBuilder />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      </main>
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
