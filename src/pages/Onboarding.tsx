// Day 21 stub — Day 25 will replace with v2 4-step narrative onboarding:
// welcome → mock workout → starter pack → tutorial battle (player destroys 1 princess).

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Onboarding() {
  const navigate = useNavigate()

  useEffect(() => {
    // Until Day 25, mark v1 done so OnboardingGate stops looping users back here,
    // and push them into the new Clash experience.
    localStorage.setItem('pulse.onboarding.completed_v1', '1')
    const id = window.setTimeout(() => navigate('/clash', { replace: true }), 800)
    return () => window.clearTimeout(id)
  }, [navigate])

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex items-center justify-center px-8">
      <div className="text-center">
        <div className="font-display font-black text-4xl text-accent-primary uppercase tracking-tight mb-3">
          PULSE
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          loading clash…
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mt-4">
          new onboarding (v2) ships Day 25
        </div>
      </div>
    </div>
  )
}
