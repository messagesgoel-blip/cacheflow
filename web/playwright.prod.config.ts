import { defineConfig } from '@playwright/test'
import liveConfig from './playwright.live.config'

export default defineConfig({
  ...liveConfig,
  timeout: 120_000,
  workers: 4,
  use: {
    ...liveConfig.use,
    baseURL: 'https://cacheflow.goels.in',
  },
})
