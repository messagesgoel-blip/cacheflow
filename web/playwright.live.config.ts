import { defineConfig } from '@playwright/test'
import baseConfig, { LIVE_ONLY_TESTS } from './playwright.config'

const liveBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://cacheflow.goels.in'

export default defineConfig({
  ...baseConfig,
  testIgnore: undefined,
  testMatch: LIVE_ONLY_TESTS,
  // Live smoke does not require the local API preflight used by deterministic runs.
  globalSetup: undefined,
  globalTeardown: undefined,
  use: {
    ...baseConfig.use,
    baseURL: liveBaseUrl,
  },
})
