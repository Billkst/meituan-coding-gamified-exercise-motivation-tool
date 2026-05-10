import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/api/users'
import { useTranslation } from '@/lib/i18n'

export default function OnboardingGate({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()
  const { t } = useTranslation()
  const onOnboardingPath = location.pathname === '/onboarding'

  // While user is loading, do NOT render children — otherwise dashboard
  // (or any non-onboarding route) flashes for ~500-1500ms before being
  // redirected to /onboarding when user.onboarded_at finally returns null.
  // Onboarding pages don't need user data, so let those render through.
  if (isLoading) {
    if (onOnboardingPath) return <>{children}</>
    return (
      <div className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center">
          <div className="font-display font-black text-4xl text-accent-primary uppercase tracking-tight mb-4 animate-pulse">
            PULSE
          </div>
          <div className="font-mono text-sm uppercase tracking-widest text-text-secondary">
            {t('auth.initializing')}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <>{children}</>

  const isOnboarded = user.onboarded_at != null

  // Only push unboarded users INTO the flow. Once on /onboarding, the flow
  // controls its own exit (Step4LootReveal navigates to /dashboard on CTA).
  if (!isOnboarded && !onOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}
