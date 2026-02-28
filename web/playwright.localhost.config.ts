import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3010',
    headless: true,
  },
  // Use the already-running dockerized web on :3010
})
