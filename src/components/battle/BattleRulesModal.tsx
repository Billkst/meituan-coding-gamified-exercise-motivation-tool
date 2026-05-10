import { IconX, type Icon } from '@tabler/icons-react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { ABILITY_ICON, ABILITY_LABEL_KEY, ABILITY_TINT } from '@/lib/battle/abilityIcons'
import type { AbilityKind } from '@/types/db'

interface Props {
  open: boolean
  onClose: () => void
}

const ABILITY_ROWS: { kind: AbilityKind; ruleKey: TranslationKey }[] = [
  { kind: 'damage_buff', ruleKey: 'battle.rules.ability.damage_buff' },
  { kind: 'first_strike', ruleKey: 'battle.rules.ability.first_strike' },
  { kind: 'pierce', ruleKey: 'battle.rules.ability.pierce' },
  { kind: 'shield', ruleKey: 'battle.rules.ability.shield' },
  { kind: 'reflect', ruleKey: 'battle.rules.ability.reflect' },
  { kind: 'heal', ruleKey: 'battle.rules.ability.heal' },
  { kind: 'xp_bonus', ruleKey: 'battle.rules.ability.xp_bonus' },
]

export default function BattleRulesModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-bg-secondary border border-white/10 rounded-card w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 md:p-8 shadow-glow-standard"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('battle.rules.close')}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary p-1"
        >
          <IconX size={18} />
        </button>

        <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-2">
          {t('battle.rules.open')}
        </div>
        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-6">
          {t('battle.rules.title')}
        </h2>

        <Section
          title={t('battle.rules.objective_title')}
          body={t('battle.rules.objective_body')}
        />
        <Section
          title={t('battle.rules.formula_title')}
          body={t('battle.rules.formula_body')}
          mono
        />

        <div className="mt-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-3">
            {t('battle.rules.abilities_title')}
          </div>
          <div className="space-y-2">
            {ABILITY_ROWS.map(({ kind, ruleKey }) => {
              const Ico: Icon = ABILITY_ICON[kind]
              return (
                <div key={kind} className="flex items-start gap-3 py-1">
                  <Ico size={18} className={'flex-shrink-0 mt-0.5 ' + ABILITY_TINT[kind]} />
                  <div className="flex-1 min-w-0">
                    <div className={'font-mono text-[10px] uppercase tracking-widest mb-0.5 ' + ABILITY_TINT[kind]}>
                      {t(ABILITY_LABEL_KEY[kind])}
                    </div>
                    <div className="font-body text-xs text-text-secondary leading-relaxed">
                      {t(ruleKey)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 font-body text-xs text-text-tertiary italic">
          {t('battle.rules.tip')}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-2.5 rounded-button shadow-glow-subtle hover:shadow-glow-standard"
        >
          {t('battle.rules.close')}
        </button>
      </div>
    </div>
  )
}

function Section({ title, body, mono }: { title: string; body: string; mono?: boolean }) {
  return (
    <div className="mb-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-2">
        {title}
      </div>
      <div className={(mono ? 'font-mono text-[11px] tabular-nums ' : 'font-body text-sm ') + 'text-text-primary leading-relaxed'}>
        {body}
      </div>
    </div>
  )
}
