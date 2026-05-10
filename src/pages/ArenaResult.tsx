import { Link, useParams } from 'react-router-dom'
import { IconArrowRight, IconArrowLeft } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useBattle } from '@/api/battles'
import type { BattleLogEntry } from '@/lib/battle/types'

export default function ArenaResult() {
  const { battleId } = useParams<{ battleId: string }>()
  const { t } = useTranslation()
  const id = battleId ? parseInt(battleId) : null
  const { data: battle, isLoading } = useBattle(id)

  if (isLoading || !battle) {
    return <div className="max-w-container mx-auto px-8 py-12 font-mono text-sm uppercase tracking-widest text-text-tertiary">…</div>
  }

  const won = battle.winner_id != null
  const xpGained = battle.attacker_xp_delta
  const log = (battle.log as BattleLogEntry[] | null) ?? []
  const lastTurn: BattleLogEntry | undefined = log[log.length - 1]
  const finalAtkHp = lastTurn?.attacker_hp_after ?? 100
  const finalDefHp = lastTurn?.defender_hp_after ?? 100

  return (
    <div className="max-w-container mx-auto px-8 py-12">
      <div className="text-center mb-12">
        <div
          className={
            'font-display text-6xl md:text-8xl font-black uppercase tracking-tight ' +
            (won ? 'text-rarity-legendary animate-halo-pulse' : 'text-text-tertiary')
          }
        >
          {won ? t('arena.result.victory') : t('arena.result.defeat')}
        </div>
        {won && (
          <div className="font-display text-3xl font-bold text-accent-primary tabular-nums mt-4">
            {t('arena.result.xp_gained', { xp: xpGained })}
          </div>
        )}
        <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mt-2">
          HP {finalAtkHp} vs {finalDefHp}
        </div>
      </div>

      <section className="bg-bg-secondary border border-white/10 rounded-card p-6 mb-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-3">
          {t('arena.result.replay_title')}
        </div>
        <div className="space-y-1 font-mono text-[11px] tabular-nums">
          {log.map((entry, i) => (
            <div key={i} className="flex justify-between text-text-secondary">
              <span>T{entry.turn} {entry.side === 'attacker' ? '→' : '←'}</span>
              <span>
                {entry.attacker_card_id} → {entry.defender_card_id} (-{entry.actual_damage})
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          to="/arena"
          className="inline-flex items-center gap-2 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-8 rounded-button shadow-glow-standard hover:shadow-glow-hero"
        >
          {t('arena.result.again')}
          <IconArrowRight size={18} />
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 border border-white/10 text-text-secondary font-mono text-xs uppercase tracking-widest py-3 px-8 rounded-button hover:border-accent-primary"
        >
          <IconArrowLeft size={14} />
          {t('arena.result.dashboard')}
        </Link>
      </div>
    </div>
  )
}
