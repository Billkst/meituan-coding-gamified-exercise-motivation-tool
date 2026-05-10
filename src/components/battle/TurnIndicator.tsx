import { useTranslation } from '@/lib/i18n'

export default function TurnIndicator({ turn }: { turn: number }) {
  const { t } = useTranslation()
  return (
    <div className="font-mono text-[11px] uppercase tracking-widest text-accent-primary">
      {t('arena.battle.turn_indicator', { n: Math.min(turn, 8) })}
    </div>
  )
}
