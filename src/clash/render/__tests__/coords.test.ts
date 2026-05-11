import { describe, it, expect } from 'vitest'
import { boardToPixel, pixelToBoard, canvasSize, BOARD } from '@/clash/render/coords'

describe('coords helpers', () => {
  const canvas = { w: 360, h: 640 }

  it('boardToPixel flips y so engine y=0 maps to canvas bottom', () => {
    const px = boardToPixel({ x: 0, y: 0 }, canvas)
    expect(px.x).toBe(0)
    expect(px.y).toBe(canvas.h)
  })

  it('boardToPixel maps top-of-board to canvas top', () => {
    const px = boardToPixel({ x: BOARD.cols, y: BOARD.rows }, canvas)
    expect(px.x).toBe(canvas.w)
    expect(px.y).toBe(0)
  })

  it('boardToPixel + pixelToBoard round-trips', () => {
    const sample = { x: 7.4, y: 22.1 }
    const round = pixelToBoard(boardToPixel(sample, canvas), canvas)
    expect(round.x).toBeCloseTo(sample.x, 6)
    expect(round.y).toBeCloseTo(sample.y, 6)
  })

  it('canvasSize keeps 18:32 aspect within the viewport (±1px rounding)', () => {
    const sz = canvasSize({ w: 800, h: 1200 })
    const cellW = sz.w / BOARD.cols
    const cellH = sz.h / BOARD.rows
    expect(Math.abs(cellW - cellH)).toBeLessThan(1)
    expect(sz.w).toBeLessThanOrEqual(800 * 0.9)
    expect(sz.h).toBeLessThanOrEqual(1200 * 0.85)
  })

  it('canvasSize never returns zero or negative for tiny viewports', () => {
    const sz = canvasSize({ w: 10, h: 10 })
    expect(sz.w).toBeGreaterThan(0)
    expect(sz.h).toBeGreaterThan(0)
  })
})
