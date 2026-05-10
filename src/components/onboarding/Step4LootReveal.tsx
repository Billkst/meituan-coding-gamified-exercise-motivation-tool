import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHandFinger } from '@tabler/icons-react'
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
  const [revealDone, setRevealDone] = useState(false)

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
          type="button"
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
    <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8">
      <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2 text-center">
        {t('onboarding.step4.title' as never)}
      </h2>
      <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-2">
        {t('onboarding.step4.subtitle' as never)}
      </div>

      {/* Tap hint while still revealing — invites users to be active */}
      {!revealDone && !idempotent && (
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent-primary/80 mb-2 animate-pulse">
          <IconHandFinger size={12} />
          {t('onboarding.step4.tap_hint' as never)}
        </div>
      )}

      <CardReveal3
        cards={ordered.slice(0, 3)}
        skipAnimation={idempotent}
        onComplete={() => setRevealDone(true)}
      />

      <div className="flex gap-4 mt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!revealDone}
          className={
            'font-display uppercase tracking-wider py-2 px-6 rounded-button border transition-all ' +
            (revealDone
              ? 'bg-bg-secondary border-white/20 text-text-secondary hover:border-white/40'
              : 'bg-bg-secondary border-white/10 text-text-tertiary opacity-40 cursor-not-allowed')
          }
        >
          {t('onboarding.prev' as never)}
        </button>
        <button
          type="button"
          onClick={proceed}
          disabled={!revealDone}
          className={
            'font-display font-bold uppercase tracking-wider py-2 px-8 rounded-button transition-all duration-300 ease-enter ' +
            (revealDone
              ? 'bg-accent-primary text-bg-primary shadow-glow-hero hover:scale-[1.03] animate-halo-pulse'
              : 'bg-bg-secondary border border-white/10 text-text-tertiary cursor-not-allowed')
          }
        >
          {revealDone
            ? t('onboarding.step4.cta' as never)
            : t('onboarding.step4.cta_disabled' as never)}
        </button>
      </div>
    </div>
  )
}
