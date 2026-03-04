import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: 'http://localhost:4011',
  },
  webServer: {
    ...baseConfig.webServer,
    command: 'npm run dev -- -p 4011',
    url: 'http://localhost:4011',
    reuseExistingServer: true,
  },
})
