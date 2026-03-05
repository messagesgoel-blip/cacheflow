import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  
  // Global setup/teardown for API preflight checks
  globalSetup: './e2e/fixtures/global-setup.ts',
  globalTeardown: './e2e/fixtures/global-teardown.ts',
  
  use: {
    baseURL: 'http://localhost:4010',
    headless: true,
    // Capture screenshot on failure for debugging
    screenshot: 'only-on-failure',
    // Record video on failure
    video: 'retain-on-failure',
  },
  
  webServer: {
    command: 'npm run dev -- -p 4010',
    url: 'http://localhost:4010',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // Retry configuration
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
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
