import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4010',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- -p 4010',
    url: 'http://localhost:4010',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
