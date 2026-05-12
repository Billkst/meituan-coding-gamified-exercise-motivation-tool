import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OnboardingGate from '../OnboardingGate'

vi.mock('@/api/users', () => ({
  useCurrentUser: vi.fn(),
}))

import { useCurrentUser } from '@/api/users'

const mockUser = (onboarded_at: string | null) => {
  ;(useCurrentUser as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { id: 'u1', onboarded_at, freeze_xp_until: null, last_protect_grant_at: '2026-05-01T00:00:00Z' },
    isLoading: false,
  })
}

const Setup = ({ initial }: { initial: string }) => (
  <MemoryRouter initialEntries={[initial]}>
    <OnboardingGate>
      <Routes>
        <Route path="/dashboard" element={<div>DASH</div>} />
        <Route path="/onboarding" element={<div>ONB</div>} />
      </Routes>
    </OnboardingGate>
  </MemoryRouter>
)

describe('OnboardingGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('not onboarded + on /dashboard → redirect to /onboarding', () => {
    mockUser(null)
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('ONB')).toBeInTheDocument()
  })

  it('onboarded + on /onboarding → no longer auto-redirects (flow controls exit)', () => {
    mockUser('2026-05-01T00:00:00Z')
    render(<Setup initial="/onboarding" />)
    expect(screen.getByText('ONB')).toBeInTheDocument()
  })

  it('onboarded + on /dashboard → no redirect', () => {
    mockUser('2026-05-01T00:00:00Z')
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })

  it('v2 completed_v2 in localStorage → treated as onboarded even without server flag', () => {
    mockUser(null)
    window.localStorage.setItem('pulse.onboarding.completed_v2', '1')
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })
})
