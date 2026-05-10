import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'
import { useGrantOnboardingPack } from '@/api/onboarding'
import CardReveal3 from '@/components/cards/CardReveal3'

interface Props {
  onPrev: () => void
  selectedSports: string[]
}

export default function Step4LootReveal({ onPrev, selectedSports }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const grant = useGrantOnboardingPack()

  useEffect(() => {
    if (grant.isPending || grant.data) return
    const buffs: Record<string, number> = {}
    for (const id of selectedSports) buffs[id] = 0.2
    grant.mutate(buffs)
  }, [grant, selectedSports])

  const proceed = () => {
    navigate('/dashboard?tour=1', { replace: true })
  }

  if (grant.isPending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="font-mono text-xs uppercase tracking-widest text-text-secondary animate-pulse">
          {t('onboarding.step4.loading' as never)}
        </div>
      </div>
    )
  }

  if (grant.isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
        <div className="font-mono text-xs uppercase tracking-widest text-semantic-error">
          {t('onboarding.step4.error_retry' as never)}
        </div>
        <button
          onClick={() => grant.reset()}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.step4.retry' as never)}
        </button>
      </div>
    )
  }

  const cards = grant.data?.cards ?? []
  const idempotent = grant.data?.idempotent ?? false

  // Reorder so highest rarity ends up at center (index 1) for hero placement
  const ordered = [...cards]
  const heroIdx = ordered.findIndex((c) => c.rarity === 'legendary' || c.rarity === 'epic')
  if (heroIdx > 0) {
    const [hero] = ordered.splice(heroIdx, 1)
    ordered.splice(1, 0, hero)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2 text-center">
        {t('onboarding.step4.title' as never)}
      </h2>
      <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
        {t('onboarding.step4.subtitle' as never)}
      </div>
      <CardReveal3 cards={ordered.slice(0, 3)} skipAnimation={idempotent} />
      <div className="flex gap-4 mt-4">
        <button
          onClick={onPrev}
          className="bg-bg-secondary border border-white/20 text-text-secondary font-display uppercase tracking-wider py-2 px-6 rounded-button"
        >
          {t('onboarding.prev' as never)}
        </button>
        <button
          onClick={proceed}
          className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero"
        >
          {t('onboarding.step4.cta' as never)}
        </button>
      </div>
    </div>
  )
}
