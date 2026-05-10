import { useTranslation, type TranslationKey } from '@/lib/i18n'

interface PlaceholderProps {
  sectionKey: TranslationKey
  titleKey: TranslationKey
  bodyKey: TranslationKey
  bodyVars?: Record<string, string | number>
}

export default function Placeholder({
  sectionKey,
  titleKey,
  bodyKey,
  bodyVars,
}: PlaceholderProps) {
  const { t } = useTranslation()
  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t(sectionKey)}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t(titleKey)}
      </h1>
      <div className="bg-bg-secondary border border-white/10 rounded-card p-8 text-text-secondary">
        {t(bodyKey, bodyVars)}
      </div>
    </div>
  )
}
