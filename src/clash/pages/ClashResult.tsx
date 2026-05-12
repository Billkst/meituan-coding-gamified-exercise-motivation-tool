import { useLocation, useNavigate } from 'react-router-dom'
import { IconSwords, IconHome2, IconCoins } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { ChestType, MatchResult } from '@/clash/lib/types'

interface ResultState {
  result: MatchResult
  gold_earned: number
  chest_id: string | null
  chest_type: ChestType | null
  win_streak: number
  player_towers_lost: number
  ai_towers_lost: number
  duration: number
  degraded?: boolean
  errorMsg?: string
}

export default function ClashResult() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const data = location.state as ResultState | null

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
            no result
          </div>
          <button
            onClick={() => navigate('/clash')}
            className="bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 px-6 rounded-button"
          >
            {t('clash.result.home' as never)}
          </button>
        </div>
      </div>
    )
  }

  const titleKey =
    data.result === 'win' ? 'clash.result.title_win'
    : data.result === 'loss' ? 'clash.result.title_loss'
    : 'clash.result.title_draw'

  const titleColor =
    data.result === 'win' ? 'text-accent-primary'
    : data.result === 'loss' ? 'text-semantic-error'
    : 'text-text-secondary'

  const titleEmoji = data.result === 'win' ? '👑' : data.result === 'loss' ? '💀' : '🤝'

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="bg-bg-secondary border border-white/10 rounded-card p-8 max-w-md w-full text-center">
        <div className="text-7xl mb-4">{titleEmoji}</div>
        <h1 className={`font-display font-black uppercase tracking-tight text-4xl ${titleColor} mb-2`}>
          {t(titleKey as never)}
        </h1>
        <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-6">
          {t('clash.result.score' as never, {
            me: data.ai_towers_lost,
            them: data.player_towers_lost,
          })}{' '}
          · {fmtTime(data.duration)}
        </div>

        {/* Rewards */}
        <div className="border-t border-white/10 pt-6 mb-6 space-y-3">
          {data.gold_earned > 0 && (
            <div className="flex items-center justify-center gap-2 font-display font-bold text-xl text-rarity-legendary">
              <IconCoins size={20} />
              {t('clash.result.gold_earned' as never, { n: data.gold_earned })}
            </div>
          )}
          {data.chest_type && (
            <div className="font-display font-bold text-base text-accent-primary">
              {data.chest_type === 'gold' ? '🟡' : '⚪'}{' '}
              {t('clash.result.chest_earned' as never, {
                type: t(`clash.chests.${data.chest_type}` as never),
              })}
            </div>
          )}
          {data.win_streak >= 2 && (
            <div className="font-mono text-xs uppercase tracking-widest text-accent-primary">
              {t('clash.result.streak' as never, { n: data.win_streak })}
            </div>
          )}
        </div>

        {data.degraded && (
          <div className="mb-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-semantic-error/80">
              (服务器结算失败 · 仅本地展示)
            </div>
            {data.errorMsg && (
              <div className="mt-1 font-mono text-[10px] text-semantic-error/70 break-words px-2 normal-case tracking-normal">
                {data.errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/clash/match')}
            className="flex-1 bg-accent-primary text-bg-primary font-display font-bold uppercase tracking-wider py-3 rounded-button shadow-glow-standard hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            <IconSwords size={16} />
            {t('clash.result.continue' as never)}
          </button>
          <button
            onClick={() => navigate('/clash')}
            className="flex-1 bg-bg-primary border border-white/15 text-text-secondary font-display uppercase tracking-wider py-3 rounded-button hover:border-white/30 transition-colors flex items-center justify-center gap-2"
          >
            <IconHome2 size={16} />
            {t('clash.result.home' as never)}
          </button>
        </div>
      </div>
    </div>
  )
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
