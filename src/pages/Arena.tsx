import { Link, useNavigate } from 'react-router-dom'
import { IconLock, IconArrowRight } from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import { useNpcOpponents } from '@/api/npcs'
import { useActiveDeck } from '@/api/deck'
import { useStartBattle } from '@/api/battles'
import { useCurrentUser } from '@/api/users'

export default function Arena() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { data: npcs = [] } = useNpcOpponents()
  const { data: deck } = useActiveDeck()
  const { data: user } = useCurrentUser()
  const startBattle = useStartBattle()

  const deckReady = !!deck && deck.card_ids.length === 8
  const isStarting = startBattle.isPending

  function onPickNpc(npcId: string) {
    if (!deckReady || isStarting) return
    startBattle.mutate(npcId, {
      onSuccess: (r) => {
        navigate(`/arena/battle/${r.battle_id}`, { state: { startResult: r } })
      },
    })
  }

  return (
    <div className="max-w-container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="font-mono text-[13px] uppercase tracking-widest text-accent-primary mb-2">
        {t('arena.section')}
      </div>
      <h1 className="font-display font-bold text-3xl uppercase tracking-tight mb-8">
        {t('arena.lobby.title')}
      </h1>

      <section className="bg-bg-secondary border border-white/10 rounded-card p-6 mb-8 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary mb-1">
            {t('arena.lobby.your_segment')}
          </div>
          <div className="font-display text-4xl font-black tabular-nums">
            {user?.season_score ?? 0}
          </div>
        </div>
        <Link
          to="/deck"
          className="font-mono text-xs uppercase tracking-widest text-accent-primary hover:underline flex items-center gap-1"
        >
          {t('arena.lobby.deck_button')}
          <IconArrowRight size={14} />
        </Link>
      </section>

      {!deckReady && (
        <div className="bg-rarity-rare/20 border-l-2 border-rarity-rare rounded-card px-4 py-3 mb-6 font-mono text-sm uppercase tracking-widest">
          {t('arena.lobby.empty_deck')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {npcs.map((n) => {
          const locked = !n.is_unlocked
          return (
            <button
              type="button"
              key={n.id}
              onClick={() => onPickNpc(n.id)}
              disabled={locked || !deckReady || isStarting}
              className={
                'text-left bg-bg-secondary border border-white/10 rounded-card p-5 transition-all ' +
                (locked || !deckReady ? 'opacity-50 cursor-not-allowed ' : 'hover:border-accent-primary hover:shadow-glow-subtle cursor-pointer ')
              }
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-accent-primary">
                  {t('arena.npc.level', { n: n.level })}
                </span>
                {locked && <IconLock size={14} className="text-text-tertiary" />}
              </div>
              <div className="font-display font-bold text-xl mb-2">
                {lang === 'zh' ? n.name_zh : n.name_en}
              </div>
              <div className="font-body text-xs text-text-secondary mb-3 italic">
                {lang === 'zh' ? n.flavor_zh : n.flavor_en}
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
                <span className="text-rarity-legendary">
                  {t('arena.npc.reward', { xp: n.reward_xp })}
                </span>
                {locked && (
                  <span className="text-text-tertiary">
                    {t('arena.npc.locked', { n: n.unlock_at_level })}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {startBattle.isError && (
        <div className="mt-6 bg-[#3a1212] border-l-2 border-semantic-error rounded-card px-4 py-3 font-mono text-sm">
          {(startBattle.error as Error).message}
        </div>
      )}
    </div>
  )
}
