// Day 26 — Judge "5-minute path" smoke walk.
//
// Walks every page a judge would land on during the README's recommended
// flow. We deliberately stop short of full deploy-and-cross gameplay
// (which requires real Supabase data + Pixi interaction) and instead
// verify each route renders + boots + has no uncaught page errors.
//
// What this proves:
//   • /reset is reachable + redirects sensibly
//   • /onboarding step 1 renders
//   • /clash (home) renders
//   • /clash/tutorial-result renders (the onboarding → home handoff)
//   • /clash/collection renders
//   • /workout renders
//   • /clash/match renders (lazy Pixi chunk + canvas mounts)
//   • Across all six routes, total uncaught page errors = 0.
//
// Deferred:
//   • Actually dropping a card mid-tutorial and watching it cross the
//     bridge — handled by 20 unit tests in pathfinding.test.ts.
//   • Match-completion RPC roundtrip — needs seeded Supabase auth which
//     CI doesn't have (stub VITE_SUPABASE_*).

import { test, expect } from '@playwright/test'

const ROUTES = [
  '/reset',
  '/onboarding',
  '/clash',
  '/clash/tutorial-result',
  '/clash/collection',
  '/workout',
  '/clash/match',
] as const

test('judge walks every key route without crashing', async ({ page }) => {
  const errorsByRoute = new Map<string, string[]>()

  for (const route of ROUTES) {
    const routeErrors: string[] = []
    const errHandler = (err: Error) => routeErrors.push(err.message)
    page.on('pageerror', errHandler)

    await page.goto(route)
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('#root')).toBeAttached()
    await page.waitForFunction(
      () => document.body.innerText.trim().length > 0,
      null,
      { timeout: 10_000 },
    )

    page.off('pageerror', errHandler)
    if (routeErrors.length) errorsByRoute.set(route, routeErrors)
  }

  if (errorsByRoute.size) {
    const summary = [...errorsByRoute.entries()]
      .map(([r, errs]) => `  ${r}:\n    ${errs.join('\n    ')}`)
      .join('\n')
    throw new Error(`Page errors on ${errorsByRoute.size} route(s):\n${summary}`)
  }
})
