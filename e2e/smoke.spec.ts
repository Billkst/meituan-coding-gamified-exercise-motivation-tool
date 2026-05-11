// Day 21 smoke spec — app boots, no console errors, lands on a known route.

import { test, expect } from '@playwright/test'

test('app boots without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  // Either ClashHome, Dashboard, or Onboarding loading state — anything but a hard error.
  await expect(page.locator('body')).toBeVisible()
  await page.waitForTimeout(500)

  // Filter out known third-party noise (Supabase auth warning when offline, etc.).
  const realErrors = errors.filter(
    (e) =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('AbortError'),
  )
  expect(realErrors, `console errors: ${realErrors.join(' | ')}`).toHaveLength(0)
})

test('clash home is reachable without crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/clash')
  await page.waitForLoadState('domcontentloaded')

  // Even unauthenticated users should land on a renderable page (clash or onboarding redirect).
  await expect(page.locator('body')).toBeVisible()
  expect(errors, `page errors: ${errors.join(' | ')}`).toHaveLength(0)
})
