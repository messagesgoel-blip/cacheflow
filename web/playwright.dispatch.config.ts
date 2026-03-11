import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4011',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx next dev -p 4011 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:4011',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  reporter: [['list']],
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 13'],
      },
    },
  ],
})
