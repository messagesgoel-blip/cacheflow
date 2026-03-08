import { defineConfig } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3010'
export const LIVE_ONLY_TESTS = [
  '**/real-*.spec.ts',
  '**/tests/providers/vps.spec.ts',
]
const useDevWebServer = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PLAYWRIGHT_USE_DEV_SERVER || '').toLowerCase(),
)
const parsedBaseUrl = (() => {
  try {
    return new URL(baseURL)
  } catch {
    return new URL('http://127.0.0.1:3010')
  }
})()
const devPort =
  Number.parseInt(process.env.PLAYWRIGHT_DEV_PORT || '', 10) ||
  Number.parseInt(parsedBaseUrl.port || '', 10) ||
  3010
const devHost = process.env.PLAYWRIGHT_DEV_HOST || '127.0.0.1'
const devServerUrl = `http://${devHost}:${devPort}`

export default defineConfig({
  testDir: './e2e',
  // Keep the default gate deterministic; live smoke runs via playwright.live.config.ts.
  testIgnore: LIVE_ONLY_TESTS,
  timeout: 90_000,
  
  // Global setup/teardown for API preflight checks
  globalSetup: './e2e/fixtures/global-setup.ts',
  globalTeardown: './e2e/fixtures/global-teardown.ts',
  
  use: {
    baseURL,
    headless: true,
    // Capture screenshot on failure for debugging
    screenshot: 'only-on-failure',
    // Record video on failure
    video: 'retain-on-failure',
  },
  
  ...(useDevWebServer
    ? {
        webServer: {
          command: `npx next dev -p ${devPort} --hostname ${devHost}`,
          url: devServerUrl,
          reuseExistingServer: false,
          timeout: 120000,
        },
      }
    : {}),
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // Retry configuration
  retries: process.env.CI ? 2 : 1,
  workers: Number.parseInt(process.env.PLAYWRIGHT_WORKERS || '1', 10) || 1,
  
  // Project configuration for different browsers
  projects: [
    {
      name: 'chromium',
      use: { 
        // Desktop Chrome viewport
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
})

