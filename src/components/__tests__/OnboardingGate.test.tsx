import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OnboardingGate from '../OnboardingGate'

vi.mock('@/api/users', () => ({
  useCurrentUser: vi.fn(),
}))
vi.mock('@/store/useDevStore', () => ({
  useDevStore: vi.fn(),
}))

import { useCurrentUser } from '@/api/users'
import { useDevStore } from '@/store/useDevStore'

const mockUser = (onboarded_at: string | null) => {
  ;(useCurrentUser as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { id: 'u1', onboarded_at, freeze_xp_until: null, last_protect_grant_at: '2026-05-01T00:00:00Z' },
    isLoading: false,
  })
}
const mockDev = (isDevMode: boolean) => {
  ;(useDevStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ isDevMode })
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
  })

  it('not onboarded + on /dashboard → redirect to /onboarding', () => {
    mockUser(null)
    mockDev(false)
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('ONB')).toBeInTheDocument()
  })

  it('onboarded + on /onboarding → redirect to /dashboard', () => {
    mockUser('2026-05-01T00:00:00Z')
    mockDev(false)
    render(<Setup initial="/onboarding" />)
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })

  it('onboarded + on /dashboard → no redirect', () => {
    mockUser('2026-05-01T00:00:00Z')
    mockDev(false)
    render(<Setup initial="/dashboard" />)
    expect(screen.getByText('DASH')).toBeInTheDocument()
  })

  it('onboarded + isDevMode + ?force=1 + on /onboarding → no redirect', () => {
    mockUser('2026-05-01T00:00:00Z')
    mockDev(true)
    render(<Setup initial="/onboarding?force=1" />)
    expect(screen.getByText('ONB')).toBeInTheDocument()
  })
})
