// NBA card on ClashHome — tells the player the next thing worth doing,
// rooted in the workout-to-gold-to-cards-to-battle loop.

import { Link } from 'react-router-dom'
import {
  IconArrowRight,
  IconBarbell,
  IconLockOpen,
  IconArrowUp,
  IconSwords,
  type Icon,
} from '@tabler/icons-react'
import { useTranslation } from '@/lib/i18n'
import type { ClashState, ClashCardWithUser } from '@/clash/lib/types'
import { nextUpgradeCost } from '@/clash/lib/cardData'

type ClashNba =
  | { kind: 'earn_gold'; deficit: number; nextUnlock: ClashCardWithUser }
  | { kind: 'unlock_next'; card: ClashCardWithUser }
  | { kind: 'upgrade'; card: ClashCardWithUser; gold: number; shards: number }
  | { kind: 'play_match' }

function pickClashNba(state: ClashState): ClashNba {
  // 1. Locked card the player can't yet afford → suggest a workout.
  const locked = state.cards
    .filter((c) => !c.unlocked && c.unlock_cost > 0)
    .sort((a, b) => a.unlock_cost - b.unlock_cost)
  if (locked.length > 0 && state.gold < locked[0].unlock_cost) {
    return {
      kind: 'earn_gold',
      deficit: locked[0].unlock_cost - state.gold,
      nextUnlock: locked[0],
    }
  }

  // 2. Locked card the player CAN afford → suggest unlocking.
  if (locked.length > 0 && state.gold >= locked[0].unlock_cost) {
    return { kind: 'unlock_next', card: locked[0] }
  }

  // 3. Affordable upgrade for one of the active deck cards.
  for (const cardId of state.deck) {
    const card = state.cards.find((c) => c.id === cardId)
    if (!card || !card.unlocked) continue
    const cost = nextUpgradeCost(card.level)
    if (!cost) continue
    if (state.gold >= cost.gold && card.shards >= cost.shards) {
      return { kind: 'upgrade', card, gold: cost.gold, shards: cost.shards }
    }
  }

  // 4. Default — go play another match.
  return { kind: 'play_match' }
}

export default function NextBestActionClash({ state }: { state: ClashState }) {
  const { t, lang } = useTranslation()
  const nba = pickClashNba(state)

  const cfg = configFor(nba, lang)
  const Ico = cfg.icon

  return (
    <Link
      to={cfg.to}
      className="block bg-bg-secondary border border-accent-primary/30 rounded-card px-5 py-4 mb-6 shadow-glow-subtle relative overflow-hidden hover:border-accent-primary/60 transition-colors group"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(circle at top right, rgba(182,255,60,0.15), transparent 60%)',
        }}
      />
      <div className="relative flex items-center gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-card bg-accent-primary/15 border border-accent-primary/40 flex items-center justify-center">
          <Ico size={20} className="text-accent-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-1">
            {t('nba.label' as never)}
          </div>
          <div className="font-display font-bold text-base md:text-lg truncate">
            {cfg.title}
          </div>
          <div className="font-body text-xs text-text-secondary mt-1 leading-snug">
            {cfg.body}
          </div>
        </div>
        <IconArrowRight size={16} className="text-accent-primary flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}

function configFor(nba: ClashNba, lang: 'zh' | 'en'): {
  icon: Icon
  to: string
  title: string
  body: string
} {
  if (nba.kind === 'earn_gold') {
    const cardName = lang === 'zh' ? nba.nextUnlock.name_zh : nba.nextUnlock.name_en
    return {
      icon: IconBarbell,
      to: '/workout',
      title: lang === 'zh' ? `打卡赚金币 → 解锁 ${cardName}` : `Train for gold → unlock ${cardName}`,
      body: lang === 'zh'
        ? `还差 ${nba.deficit} 💰 解锁 ${cardName} (${nba.nextUnlock.emoji} ${nba.nextUnlock.rarity}) · 一次力量训练 ≈ 300 💰`
        : `${nba.deficit} 💰 short of ${cardName} (${nba.nextUnlock.emoji}). 1 workout ≈ 300 💰.`,
    }
  }
  if (nba.kind === 'unlock_next') {
    const cardName = lang === 'zh' ? nba.card.name_zh : nba.card.name_en
    return {
      icon: IconLockOpen,
      to: '/clash/cards',
      title: lang === 'zh' ? `解锁 ${cardName}` : `Unlock ${cardName}`,
      body: lang === 'zh'
        ? `${nba.card.emoji} ${nba.card.rarity} · ${nba.card.unlock_cost} 💰 即可入手`
        : `${nba.card.emoji} ${nba.card.rarity} · ${nba.card.unlock_cost} 💰 to unlock`,
    }
  }
  if (nba.kind === 'upgrade') {
    const cardName = lang === 'zh' ? nba.card.name_zh : nba.card.name_en
    return {
      icon: IconArrowUp,
      to: '/clash/cards',
      title: lang === 'zh' ? `升级 ${cardName} → Lv ${nba.card.level + 1}` : `Upgrade ${cardName} → Lv ${nba.card.level + 1}`,
      body: lang === 'zh'
        ? `${nba.card.emoji} 当前 Lv ${nba.card.level} · 升级花费 ${nba.gold} 💰 ${nba.shards} 💎`
        : `${nba.card.emoji} Lv ${nba.card.level} now · costs ${nba.gold} 💰 ${nba.shards} 💎`,
    }
  }
  // play_match
  return {
    icon: IconSwords,
    to: '/clash/match',
    title: lang === 'zh' ? '套装就绪 · 去对战' : 'Deck ready · Go battle',
    body: lang === 'zh'
      ? '所有可解锁的卡都在你手上 · 试试新组合'
      : 'All your unlockable cards are in hand · try a new combo',
  }
}
