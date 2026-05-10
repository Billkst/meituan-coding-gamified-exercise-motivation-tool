import { useEffect, useState } from 'react'

interface Props {
  amount: number | null
  label?: string
  side: 'top' | 'bottom'
}

export default function DamageFloat({ amount, label, side }: Props) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (amount == null) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 800)
    return () => clearTimeout(t)
  }, [amount])
  if (!show || amount == null) return null
  return (
    <div
      className={
        'absolute left-1/2 -translate-x-1/2 pointer-events-none animate-fade-up font-display text-3xl font-black ' +
        (side === 'top' ? 'top-12 ' : 'bottom-12 ') +
        (label === 'PIERCE' ? 'text-rarity-legendary' : 'text-semantic-error')
      }
    >
      {label ? `${label} ` : ''}-{amount}
    </div>
  )
}
