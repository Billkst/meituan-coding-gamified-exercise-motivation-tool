import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Bypass proxy for local dev server (WSL2 has HTTP_PROXY set globally
    // which intercepts even 127.0.0.1).
    launchOptions: {
      args: ['--proxy-bypass-list=127.0.0.1;localhost;*.localhost;<-loopback>'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Mobile (WebKit/iPhone 12 viewport) deferred to Day 26 when we
    // install WebKit deps (libgtk + libwoff1 + gstreamer). Day 21 smoke
    // only validates chromium happy path.
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // WSL2 local dev has HTTP_PROXY set globally; ensure Playwright bypasses it
    // for the local Vite server (browser fetch + page.goto already use 127.0.0.1).
    env: {
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    },
  },
})
