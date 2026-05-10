// Elixir bar: 10 segments + a fractional "current segment" overlay.

import { ARENA } from '@/clash/lib/arena'
import type { ElixirState, MatchPhase } from '@/clash/engine/types'

interface Props {
  elixir: ElixirState
  phase: MatchPhase
}

export default function ElixirBar({ elixir, phase }: Props) {
  const max = ARENA.elixirMaxNormal
  const fractional = elixir.partial
  const fillPct = ((elixir.current + fractional) / max) * 100
  const isOvertime = phase === 'overtime'

  return (
    <div data-tour="clash.elixir" className="px-3 py-1.5 bg-bg-primary border-t border-white/10">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-rarity-epic">
          {Math.floor(elixir.current)}/10
        </span>
        <div className="flex-1 h-3 bg-bg-secondary rounded-full overflow-hidden border border-white/10 relative">
          <div
            className={
              'h-full transition-[width] duration-100 bg-gradient-to-r ' +
              (isOvertime
                ? 'from-rarity-epic to-rarity-legendary'
                : 'from-rarity-epic to-rarity-rare')
            }
            style={{ width: `${fillPct}%` }}
          />
          {/* Segment dividers */}
          <div className="absolute inset-0 flex pointer-events-none">
            {Array.from({ length: max - 1 }, (_, i) => (
              <div
                key={i}
                className="border-r border-bg-primary/60 flex-1"
              />
            ))}
            <div className="flex-1" />
          </div>
        </div>
        {isOvertime && (
          <span className="font-mono text-[9px] uppercase tracking-widest text-rarity-legendary animate-pulse">
            ×2
          </span>
        )}
      </div>
    </div>
  )
}
