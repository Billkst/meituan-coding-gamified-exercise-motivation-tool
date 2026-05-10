import { useEffect, useState } from 'react'
import { IconX, IconArrowRight, IconArrowLeft } from '@tabler/icons-react'
import { useTranslation, type TranslationKey } from '@/lib/i18n'

export interface TourStep {
  /** data-tour attribute on the target element. Empty/undefined = centered modal. */
  target?: string
  titleKey: TranslationKey
  bodyKey: TranslationKey
}

interface Props {
  steps: TourStep[]
  open: boolean
  onClose: () => void
}

const PAD = 8
const TOOLTIP_W = 320
const TOOLTIP_GAP = 14
const APPROX_TOOLTIP_H = 220

export default function SpotlightTour({ steps, open, onClose }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [vp, setVp] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!open) return
    setStep(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const update = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight })
      const targetKey = steps[step]?.target
      if (!targetKey) {
        setRect(null)
        return
      }
      const el = document.querySelector<HTMLElement>(`[data-tour="${targetKey}"]`)
      if (!el) {
        setRect(null)
        return
      }
      // Scroll into view, then read rect on next frame
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      requestAnimationFrame(() => {
        setRect(el.getBoundingClientRect())
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, step, steps])

  // ESC closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isLast = step === steps.length - 1
  const isFirst = step === 0
  const next = () => (isLast ? onClose() : setStep(step + 1))
  const prev = () => setStep(Math.max(0, step - 1))

  // Tooltip body — shared between spotlight and centered modes
  const TooltipBody = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2.5 right-2.5 text-text-tertiary hover:text-text-primary p-1"
        aria-label={t('tour.skip')}
      >
        <IconX size={16} />
      </button>
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent-primary mb-2 tabular-nums">
        {step + 1} / {steps.length}
      </div>
      <h3 className="font-display font-bold text-lg md:text-xl uppercase tracking-tight mb-2 pr-6">
        {t(steps[step].titleKey)}
      </h3>
      <p className="font-body text-sm text-text-secondary leading-relaxed mb-4">
        {t(steps[step].bodyKey)}
      </p>

      <div className="flex items-center gap-1 mb-4">
        {steps.map((_, i) => (
          <span
            key={i}
            className={
              'h-1 flex-1 rounded-full transition-colors ' +
              (i === step
                ? 'bg-accent-primary'
                : i < step
                ? 'bg-accent-primary/40'
                : 'bg-white/10')
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary hover:text-text-primary"
        >
          {t('tour.skip')}
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={prev}
              className="font-mono text-[10px] uppercase tracking-widest border border-white/10 hover:border-accent-primary py-1.5 px-3 rounded-button inline-flex items-center gap-1"
            >
              <IconArrowLeft size={11} />
              {t('tour.prev')}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="font-mono text-[10px] uppercase tracking-widest bg-accent-primary text-bg-primary py-1.5 px-3 rounded-button shadow-glow-subtle hover:shadow-glow-standard inline-flex items-center gap-1"
          >
            {isLast ? t('tour.done') : t('tour.next')}
            {!isLast && <IconArrowRight size={11} />}
          </button>
        </div>
      </div>
    </>
  )

  // No target → centered modal (welcome / done / fallback for mobile or hidden targets)
  if (!rect) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-8">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-bg-secondary border border-accent-primary/40 rounded-card w-full max-w-md p-6 md:p-7 shadow-glow-standard"
        >
          {TooltipBody}
        </div>
      </div>
    )
  }

  // Has target → spotlight + tooltip
  const holeL = Math.max(0, rect.left - PAD)
  const holeT = Math.max(0, rect.top - PAD)
  const holeR = Math.min(vp.w, rect.right + PAD)
  const holeB = Math.min(vp.h, rect.bottom + PAD)
  const holeW = holeR - holeL
  const holeH = holeB - holeT

  // Pick tooltip side that fits
  let tipLeft: number
  let tipTop: number
  if (rect.right + TOOLTIP_GAP + TOOLTIP_W < vp.w - 16) {
    // right of target
    tipLeft = rect.right + TOOLTIP_GAP
    tipTop = rect.top
  } else if (rect.left - TOOLTIP_GAP - TOOLTIP_W > 16) {
    // left of target
    tipLeft = rect.left - TOOLTIP_GAP - TOOLTIP_W
    tipTop = rect.top
  } else if (rect.bottom + TOOLTIP_GAP + APPROX_TOOLTIP_H < vp.h - 16) {
    // below target, horizontally centered
    tipLeft = Math.max(
      16,
      Math.min(vp.w - TOOLTIP_W - 16, rect.left + rect.width / 2 - TOOLTIP_W / 2),
    )
    tipTop = rect.bottom + TOOLTIP_GAP
  } else {
    // above target
    tipLeft = Math.max(
      16,
      Math.min(vp.w - TOOLTIP_W - 16, rect.left + rect.width / 2 - TOOLTIP_W / 2),
    )
    tipTop = Math.max(16, rect.top - TOOLTIP_GAP - APPROX_TOOLTIP_H)
  }
  // Clamp tooltip vertically so it doesn't bleed
  tipTop = Math.max(16, Math.min(vp.h - APPROX_TOOLTIP_H - 16, tipTop))

  return (
    <>
      {/* 4-piece dim mask, click anywhere to advance */}
      <div
        onClick={next}
        className="fixed left-0 top-0 right-0 bg-black/75 z-[60] cursor-pointer"
        style={{ height: holeT }}
      />
      <div
        onClick={next}
        className="fixed left-0 bg-black/75 z-[60] cursor-pointer"
        style={{ top: holeT, height: holeH, width: holeL }}
      />
      <div
        onClick={next}
        className="fixed right-0 bg-black/75 z-[60] cursor-pointer"
        style={{ top: holeT, height: holeH, left: holeR }}
      />
      <div
        onClick={next}
        className="fixed left-0 right-0 bottom-0 bg-black/75 z-[60] cursor-pointer"
        style={{ top: holeB }}
      />

      {/* Spotlight ring — pointer-events:none so the target stays clickable */}
      <div
        className="fixed border-2 border-accent-primary rounded-lg pointer-events-none animate-halo-pulse z-[60]"
        style={{
          left: holeL,
          top: holeT,
          width: holeW,
          height: holeH,
          boxShadow: '0 0 24px rgba(182,255,60,0.6), 0 0 60px rgba(182,255,60,0.3)',
        }}
      />

      {/* Tooltip */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[61] bg-bg-secondary border border-accent-primary rounded-card shadow-glow-standard p-5"
        style={{ left: tipLeft, top: tipTop, width: TOOLTIP_W }}
      >
        {TooltipBody}
      </div>
    </>
  )
}
