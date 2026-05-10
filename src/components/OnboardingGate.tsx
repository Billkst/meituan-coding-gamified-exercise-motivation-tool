import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/api/users'
import { useDevStore } from '@/store/useDevStore'

export default function OnboardingGate({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()
  const { isDevMode } = useDevStore()

  if (isLoading || !user) return <>{children}</>

  const isOnboarded = user.onboarded_at != null
  const onOnboardingPath = location.pathname === '/onboarding'
  const forceParam = new URLSearchParams(location.search).get('force') === '1'

  if (!isOnboarded && !onOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }
  if (isOnboarded && onOnboardingPath && !(isDevMode && forceParam)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
