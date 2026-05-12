import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/api/users'
import { useTranslation } from '@/lib/i18n'

export default function OnboardingGate({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()
  const { t } = useTranslation()
  const onOnboardingPath = location.pathname === '/onboarding'
  // Pass-through paths: always renderable regardless of onboarded state.
  // /reset must work for stuck judges; /clash/tutorial-result is the
  // designed exit from onboarding step 4 → ClashHome handoff.
  const isPassThrough =
    location.pathname === '/reset' ||
    location.pathname === '/clash/tutorial-result' ||
    (location.pathname === '/clash/match' &&
      new URLSearchParams(location.search).get('tutorial') === '1')

  // While user is loading, do NOT render children — otherwise dashboard
  // (or any non-onboarding route) flashes for ~500-1500ms before being
  // redirected to /onboarding when user.onboarded_at finally returns null.
  // Onboarding pages don't need user data, so let those render through.
  if (isLoading) {
    if (onOnboardingPath || isPassThrough) return <>{children}</>
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

  // Onboarding state has two backing stores:
  //   - users.onboarded_at (v1, server-side) — set by complete_onboarding RPC
  //   - pulse.onboarding.completed_v2 (v2, localStorage) — set by TutorialResult
  //     or the Step 3 skip-tutorial link
  // v2 deliberately does NOT write to the server column because the flow is
  // pure client narrative + a starter pack grant. Either flag is enough to
  // consider the user "onboarded" — otherwise the v2-skip path bounces
  // through /onboarding → /clash → /onboarding (infinite redirect).
  const v2Completed =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('pulse.onboarding.completed_v2') === '1'
  const isOnboarded = user.onboarded_at != null || v2Completed

  // Only push unboarded users INTO the flow. Once on /onboarding, the flow
  // controls its own exit (TutorialResult navigates to /clash on CTA).
  if (!isOnboarded && !onOnboardingPath && !isPassThrough) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}
