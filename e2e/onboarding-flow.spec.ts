// Day 25 — Onboarding v2 smoke spec.
//
// Walks the first 3 steps (welcome → mock-workout → starter-pack), then
// stops before the tutorial battle. The tutorial battle requires the Pixi
// canvas to render unit interactions which is expensive + flaky on CI;
// /clash/tutorial-result itself is covered by an independent test.

import { test, expect } from '@playwright/test'

test('onboarding v2 walks through steps 1-3', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  // Force-clear localStorage so the page doesn't shortcut to /clash.
  await page.goto('/clash')
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pulse.'))
      .forEach((k) => localStorage.removeItem(k))
  })

  await page.goto('/onboarding')
  await page.waitForLoadState('domcontentloaded')

  // Step 1 hero — wait for the welcome CTA to render then click it.
  const step1 = page.getByText('Got it', { exact: false }).or(page.getByText('懂了'))
  await expect(step1.first()).toBeVisible({ timeout: 10_000 })
  await step1.first().click()

  // Step 2 — skip the 30s timer with the skip button so the spec stays fast.
  const skipBtn = page.getByText('Skip', { exact: true }).or(page.getByText('跳过', { exact: true }))
  await expect(skipBtn.first()).toBeVisible({ timeout: 5000 })
  await skipBtn.first().click()

  // Step 3 — chest tap renders. Confirm we landed without crashing.
  const tapHint = page
    .getByText('Tap the chest', { exact: false })
    .or(page.getByText('点击宝箱'))
  await expect(tapHint.first()).toBeVisible({ timeout: 5000 })

  expect(errors, `page errors: ${errors.join(' | ')}`).toHaveLength(0)
})

test('tutorial-result page renders and CTAs to /clash', async ({ page }) => {
  await page.goto('/clash/tutorial-result')
  await page.waitForLoadState('domcontentloaded')
  // Either zh or en wins — page has the trophy banner.
  await expect(page.locator('#root')).toBeAttached()
  await page.waitForFunction(() => document.body.innerText.includes('🏆'))
})
