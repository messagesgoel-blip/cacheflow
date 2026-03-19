import { defineConfig } from '@playwright/test'
import baseConfig, { LIVE_ONLY_TESTS } from './playwright.config'
import * as fs from 'node:fs'
import * as path from 'path'

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return

  const contents = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line
    const separatorIndex = withoutExport.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = withoutExport.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = withoutExport.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const commentIndex = value.search(/\s+#/)
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trim()
    }

    process.env[key] = value
  }
}

loadEnvFile(path.resolve(__dirname, '.env.live'))

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
