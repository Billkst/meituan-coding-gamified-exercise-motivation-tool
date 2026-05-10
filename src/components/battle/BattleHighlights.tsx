import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useAllCards } from '@/api/cards'
import { ABILITY_ICON, ABILITY_LABEL_KEY, ABILITY_TINT } from '@/lib/battle/abilityIcons'
import type { BattleLogEntry } from '@/lib/battle/types'
import type { AbilityKind } from '@/types/db'

interface Props {
  log: BattleLogEntry[]
}

export default function BattleHighlights({ log }: Props) {
  const { t, lang } = useTranslation()
  const { data: allCards = [] } = useAllCards()

  const cardName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of allCards) m.set(c.id, lang === 'zh' ? c.name_zh : c.name_en)
    return m
  }, [allCards, lang])

  const keyMoment = useMemo(() => {
    if (log.length === 0) return null
    return log.reduce((best, e) => (e.actual_damage > best.actual_damage ? e : best), log[0])
  }, [log])

  const triggerStats = useMemo(() => {
    const counts: Partial<Record<AbilityKind, number>> = {}
    for (const e of log) {
      for (const tg of e.triggers_fired) {
        counts[tg.kind] = (counts[tg.kind] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  }, [log])

  // HP curve points: 0 turn 0 = 100/100, then read from log entries.
  const curvePoints = useMemo(() => {
    const atkSeries: number[] = [100]
    const defSeries: number[] = [100]
    for (const e of log) {
      atkSeries.push(e.attacker_hp_after)
      defSeries.push(e.defender_hp_after)
    }
    return { atk: atkSeries, def: defSeries }
  }, [log])

  if (log.length === 0) return null

  return (
    <section className="bg-bg-secondary border border-white/10 rounded-card p-5 md:p-6 mb-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-4">
        {t('battle.highlights.title')}
      </div>

      {/* Key moment */}
      {keyMoment && (
        <div className="mb-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-1.5">
            {t('battle.highlights.key_moment')}
          </div>
          <div className="font-body text-sm text-text-primary">
            {t('battle.highlights.key_moment_body', {
              turn: keyMoment.turn,
              atk: cardName.get(keyMoment.attacker_card_id) ?? keyMoment.attacker_card_id,
              def: cardName.get(keyMoment.defender_card_id) ?? keyMoment.defender_card_id,
              dmg: keyMoment.actual_damage,
            })}
          </div>
        </div>
      )}

      {/* Trigger stats */}
      <div className="mb-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-2">
          {t('battle.highlights.triggers')}
        </div>
        {triggerStats.length === 0 ? (
          <div className="font-body text-xs text-text-tertiary italic">
            {t('battle.highlights.no_triggers')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {triggerStats.map(([kind, count]) => {
              const Ico = ABILITY_ICON[kind as AbilityKind]
              return (
                <div
                  key={kind}
                  className={
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full bg-bg-primary/40 border border-white/10 font-mono text-[10px] tabular-nums uppercase tracking-widest ' +
                    ABILITY_TINT[kind as AbilityKind]
                  }
                >
                  <Ico size={10} />
                  <span>{t(ABILITY_LABEL_KEY[kind as AbilityKind])}</span>
                  <span className="opacity-60">×{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* HP curve */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-2">
          {t('battle.highlights.hp_curve')}
        </div>
        <HpCurve atk={curvePoints.atk} def={curvePoints.def} />
      </div>
    </section>
  )
}

function HpCurve({ atk, def }: { atk: number[]; def: number[] }) {
  const w = 320
  const h = 80
  const pad = 6
  const n = Math.max(atk.length, def.length)
  if (n < 2) return null
  const stepX = (w - pad * 2) / (n - 1)
  const yFor = (hp: number) => h - pad - ((Math.max(0, Math.min(100, hp)) / 100) * (h - pad * 2))

  const polyline = (vals: number[]) =>
    vals.map((v, i) => `${pad + i * stepX},${yFor(v)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      {/* baseline grid */}
      <line x1={pad} y1={yFor(50)} x2={w - pad} y2={yFor(50)} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" />
      <line x1={pad} y1={yFor(100)} x2={w - pad} y2={yFor(100)} stroke="rgba(255,255,255,0.05)" />
      <line x1={pad} y1={yFor(0)} x2={w - pad} y2={yFor(0)} stroke="rgba(255,255,255,0.05)" />
      {/* attacker (you) */}
      <polyline
        points={polyline(atk)}
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="2"
      />
      {/* defender (opponent) */}
      <polyline
        points={polyline(def)}
        fill="none"
        stroke="var(--semantic-error)"
        strokeWidth="2"
      />
    </svg>
  )
}
