// Pixi battlefield <-> engine board coordinate helpers.
//
// Engine convention (from ARENA): 18 cols × 32 rows, y=0 is the player edge
// (bottom of screen), y=rows is the enemy edge (top). Pixi canvas y grows
// downward, so boardToPixel flips y.

import { ARENA } from '@/clash/lib/arena'

export const BOARD = { cols: ARENA.cols, rows: ARENA.rows } as const

export interface CanvasSize {
  w: number
  h: number
}

/**
 * Fit a 9:16-aspect canvas inside the given viewport while leaving room for
 * the top chrome (~15%) and side gutters (~10%).
 */
export function canvasSize(viewport: { w: number; h: number }): CanvasSize {
  const maxByWidth = (viewport.w * 0.9) / BOARD.cols
  const maxByHeight = (viewport.h * 0.85) / BOARD.rows
  const cell = Math.max(1, Math.min(maxByWidth, maxByHeight))
  return { w: Math.round(cell * BOARD.cols), h: Math.round(cell * BOARD.rows) }
}

/**
 * Convert engine-space (x∈[0,cols], y∈[0,rows], y-up) to canvas-space pixels (y-down).
 */
export function boardToPixel(pos: { x: number; y: number }, canvas: CanvasSize) {
  return {
    x: (pos.x / BOARD.cols) * canvas.w,
    y: (1 - pos.y / BOARD.rows) * canvas.h,
  }
}

/**
 * Convert canvas-space pixels (y-down) back to engine-space (y-up).
 */
export function pixelToBoard(px: { x: number; y: number }, canvas: CanvasSize) {
  return {
    x: (px.x / canvas.w) * BOARD.cols,
    y: (1 - px.y / canvas.h) * BOARD.rows,
  }
}
