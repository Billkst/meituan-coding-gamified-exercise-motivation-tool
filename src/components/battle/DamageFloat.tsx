interface Props {
  amount: number
}

// Floats a "-N" red number above the parent container. Mounted only while
// the parent is in an animating phase; unmounts when the phase changes.
export default function DamageFloat({ amount }: Props) {
  return (
    <div
      className="absolute left-1/2 top-1/2 z-20 pointer-events-none animate-damage-float font-display font-black text-3xl text-semantic-error tabular-nums"
      style={{
        textShadow: '0 0 12px rgba(255,80,80,0.9), 0 0 24px rgba(255,40,40,0.6)',
      }}
    >
      -{amount}
    </div>
  )
}
