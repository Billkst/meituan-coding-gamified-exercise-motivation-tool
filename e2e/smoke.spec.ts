// Day 21 smoke spec — app boots, mounts React, renders *something*.
//
// We deliberately do NOT assert `body` visibility: the Onboarding stub uses
// `fixed inset-0` for its only child, which collapses body to 0 height on
// Ubuntu CI and trips Playwright's toBeVisible check even though the page
// rendered fine. Assert on `#root` attachment + non-empty innerText, which
// works whether we land on OnboardingGate's loading screen, the Onboarding
// stub, or ClashHome.

import { test, expect } from '@playwright/test'

test('app boots without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  await expect(page.locator('#root')).toBeAttached()
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, {
    timeout: 10_000,
  })

  // Filter out known third-party noise (Supabase fetch failure in CI is expected
  // because we use stub env vars; the React shell should still render).
  const realErrors = errors.filter(
    (e) =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('AbortError') &&
      !e.includes('ERR_NAME_NOT_RESOLVED') &&
      !e.toLowerCase().includes('supabase'),
  )
  expect(realErrors, `console errors: ${realErrors.join(' | ')}`).toHaveLength(0)
})

test('clash home is reachable without crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/clash')
  await page.waitForLoadState('domcontentloaded')

  await expect(page.locator('#root')).toBeAttached()
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, {
    timeout: 10_000,
  })

  expect(errors, `page errors: ${errors.join(' | ')}`).toHaveLength(0)
})
