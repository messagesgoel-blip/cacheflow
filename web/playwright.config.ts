import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  
  // Global setup/teardown for API preflight checks
  globalSetup: './e2e/fixtures/global-setup.ts',
  globalTeardown: './e2e/fixtures/global-teardown.ts',
  
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    // Capture screenshot on failure for debugging
    screenshot: 'only-on-failure',
    // Record video on failure
    video: 'retain-on-failure',
  },
  
  webServer: {
    command: 'echo "Using existing server"',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 10000,
  },
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // Retry configuration
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  
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
