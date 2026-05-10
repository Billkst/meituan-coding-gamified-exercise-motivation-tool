import { useTranslation } from '@/lib/i18n'

interface Props {
  onDone: () => void
}

export default function DashboardTourOverlay({ onDone }: Props) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center px-8">
      <div className="max-w-md space-y-8 text-center mb-12">
        <Tip n={1} text={t('onboarding.step5.tip1' as never) as string} />
        <Tip n={2} text={t('onboarding.step5.tip2' as never) as string} />
        <Tip n={3} text={t('onboarding.step5.tip3' as never) as string} />
      </div>
      <button
        onClick={onDone}
        className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-12 rounded-button shadow-glow-standard hover:shadow-glow-hero hover:scale-[1.02] transition-all"
      >
        {t('onboarding.step5.cta' as never)}
      </button>
    </div>
  )
}

function Tip({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-accent-primary text-bg-primary font-display font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="font-body text-base text-text-primary text-left">{text}</div>
    </div>
  )
}
