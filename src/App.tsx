import { Routes, Route, Navigate } from 'react-router-dom'
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
