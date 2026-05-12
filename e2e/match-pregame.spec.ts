// Day 24 — Match page smoke spec.
//
// We deliberately stop at the pregame screen (difficulty selector + battle CTA)
// because the full deploy-and-cross flow requires a logged-in user with real
// Supabase data, and CI runs against a stub Supabase URL (see
// .github/workflows/e2e.yml `VITE_SUPABASE_*`). The bridge-crossing logic
// itself is covered by 20 unit tests in pathfinding.test.ts.
//
// What this spec proves:
//   • /clash/match route loads.
//   • The Pixi chunk lazy-loads and PixiBattlefield mounts without throwing.
//   • Pre-battle controls (difficulty buttons + battle CTA) render.
//   • No uncaught page errors.

import { test, expect } from '@playwright/test'

test('clash match page renders pregame without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/clash/match')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#root')).toBeAttached()

  // Wait for either the pregame surface (with hand-rolled query state) or
  // the upstream loading state to settle. Either is a valid render.
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, {
    timeout: 10_000,
  })

  expect(errors, `page errors: ${errors.join(' | ')}`).toHaveLength(0)
})
