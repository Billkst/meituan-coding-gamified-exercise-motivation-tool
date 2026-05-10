import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProgressDots from '@/components/onboarding/ProgressDots'
import Step1Welcome from '@/components/onboarding/Step1Welcome'
import Step2Sports from '@/components/onboarding/Step2Sports'
import Step3MockWorkout from '@/components/onboarding/Step3MockWorkout'
import Step4LootReveal from '@/components/onboarding/Step4LootReveal'

const STEP_COUNT = 5  // step 5 = dashboard tour overlay

export default function Onboarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSports, setSelectedSports] = useState<string[]>([])

  const stepNum = Math.min(4, Math.max(1, parseInt(searchParams.get('step') ?? '1', 10)))
  const goNext = () => setSearchParams({ step: String(stepNum + 1) })
  const goPrev = () => setSearchParams({ step: String(stepNum - 1) })

  const handleStep2Next = (sports: string[]) => {
    setSelectedSports(sports)
    goNext()
  }

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col">
      <ProgressDots current={stepNum} total={STEP_COUNT} />
      {stepNum === 1 && <Step1Welcome onNext={goNext} />}
      {stepNum === 2 && <Step2Sports onNext={handleStep2Next} onPrev={goPrev} />}
      {stepNum === 3 && <Step3MockWorkout onNext={goNext} onPrev={goPrev} defaultSportId={selectedSports[0] ?? null} />}
      {stepNum === 4 && <Step4LootReveal onPrev={goPrev} selectedSports={selectedSports} />}
    </div>
  )
}
