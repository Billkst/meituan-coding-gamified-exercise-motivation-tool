import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/api/users'

export default function OnboardingGate({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()

  if (isLoading || !user) return <>{children}</>

  const isOnboarded = user.onboarded_at != null
  const onOnboardingPath = location.pathname === '/onboarding'

  // Only push unboarded users INTO the flow. Once a user is on /onboarding we
  // let the flow control its own exit (Step4LootReveal navigates to /dashboard
  // when the user clicks CTA). Otherwise grant_onboarding_pack flipping
  // onboarded_at mid-reveal would yank Step4 unmount before cards finish.
  if (!isOnboarded && !onOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}
