// Day 25 — Onboarding v2: 4-step narrative.
//   1. Welcome — explain the product loop in plain language.
//   2. Mock workout — 30s simulated jog → +200 gold visual feedback.
//   3. Starter pack — chest open + 6-card reveal.
//   4. Tutorial battle — redirect to /clash/match?tutorial=1 where the player
//      destroys 1 princess; TutorialResult lands them at /clash.
//
// We persist `pulse.onboarding.completed_v2 = '1'` only at the end of the
// tutorial (in TutorialResult), so a user who quits mid-flow re-enters at
// step 1. This is intentional — the four steps are the product pitch and
// dropping them halfway means the user didn't see it.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Step1Welcome from '@/components/onboarding/v2/Step1Welcome'
import Step2MockWorkout from '@/components/onboarding/v2/Step2MockWorkout'
import Step3StarterPack from '@/components/onboarding/v2/Step3StarterPack'

type Step = 1 | 2 | 3

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)

  // If the user already finished v2, bail straight to /clash so we don't
  // make them sit through onboarding again on every fresh session.
  useEffect(() => {
    if (window.localStorage.getItem('pulse.onboarding.completed_v2') === '1') {
      navigate('/clash', { replace: true })
    }
  }, [navigate])

  if (step === 1) return <Step1Welcome onContinue={() => setStep(2)} />
  if (step === 2) return <Step2MockWorkout onContinue={() => setStep(3)} />
  if (step === 3)
    return (
      <Step3StarterPack
        onContinue={() => navigate('/clash/match?tutorial=1', { replace: true })}
        onSkipTutorial={() => {
          // Skipping still counts as "completed" — the user has seen the
          // pitch through step 3, they just don't want the hands-on battle.
          window.localStorage.setItem('pulse.onboarding.completed_v2', '1')
          navigate('/clash', { replace: true })
        }}
      />
    )
  return null
}
