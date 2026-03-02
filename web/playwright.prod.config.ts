import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 4,
  use: {
    baseURL: 'https://cacheflow.goels.in',
    headless: true,
  },
})
