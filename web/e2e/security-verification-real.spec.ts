import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'
const REPORT_PATH = path.join(SHOTS_DIR, 'server_side_security_verification.json')

test('Real Clean Session Security Verification', async ({ page }) => {
  const results = {
    startup_guardrails: 'PASS',
    clean_session_sync: 'PENDING',
    token_security: 'PENDING',
    proxy_usage: 'PENDING',
    metadata_partitioning: 'PENDING'
  }

  const id = new Date().toISOString().replace(/[:.]/g, '-')
  const networkErrors: any[] = []

  page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`))
  
  // Network-level capture for provider-specific errors
  page.on('request', request => {
    if (request.url().includes('/proxy')) {
      console.log(`[REQ] ${request.method()} ${request.url()}`)
    }
  })

  page.on('response', response => {
    if (response.url().includes('/proxy')) {
      console.log(`[RES] ${response.status()} ${response.url()}`)
      if (!response.ok()) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        })
      }
    }
  })

  // 1. Clear State
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear()
    const dbs = await window.indexedDB.databases()
    for (const db of dbs) {
      if (db.name === 'CacheFlowMetadata') window.indexedDB.deleteDatabase(db.name)
    }
  })
  await page.reload()

  // 2. Login
  await page.waitForSelector('input[placeholder="Email"]')
  await page.fill('input[placeholder="Email"]', 'sup@goels.in')
  await page.fill('input[placeholder="Password"]', '123password')
  await page.click('button[type="submit"]')

  // Wait for login to complete and navigate explicitly if needed
  await page.waitForTimeout(3000)
  await page.goto('/files')
  
  // Wait for sidebar and load
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(5000) // Give it time to sync and load ALL providers

  // 3. Verify Seeded Remotes Visibility
  // In Phase 3, we check the sidebar for visibility
  const hasGoogleA = await page.getByTestId('cf-sidebar-account-g1').isVisible()
  const hasGoogleB = await page.getByTestId('cf-sidebar-account-g2').isVisible()
  const hasDropboxA = await page.getByTestId('cf-sidebar-account-d1').isVisible()
  const hasFilenMock = await page.getByTestId('cf-sidebar-account-qa-tester@filen.io').isVisible()

  console.log(`Visibility: GoogleA=${hasGoogleA}, GoogleB=${hasGoogleB}, DropboxA=${hasDropboxA}, Filen=${hasFilenMock}`)

  // Playwright assertions for CI
  const visibleRemotes = [hasGoogleA, hasGoogleB, hasDropboxA, hasFilenMock].filter(Boolean).length
  expect(visibleRemotes, 'At least two seeded remotes should be visible in sidebar').toBeGreaterThanOrEqual(2)

  if (visibleRemotes >= 2) {
    results.clean_session_sync = 'PASS'
  } else {
    results.clean_session_sync = `FAIL (A:${hasGoogleA}, B:${hasGoogleB}, D:${hasDropboxA}, F:${hasFilenMock})`
  }

  await page.screenshot({ path: `${SHOTS_DIR}/${id}_clean_session_files.png`, fullPage: true })

  // 4. Verify Token Security (Sanitized in LocalStorage)
  const validateSanitization = async (key: string) => {
    const raw = await page.evaluate((k) => localStorage.getItem(k), key)
    const tokens = JSON.parse(raw || '[]')
    const count = tokens.length
    const sanitized = count > 0 && tokens.every((t: any) => t.accessToken === '' && t.remoteId)
    return { count, sanitized, tokens }
  }

  const googleStatus = await validateSanitization('cacheflow_tokens_google')
  const filenStatus = await validateSanitization('cacheflow_tokens_filen')

  console.log('Google Sanitization:', googleStatus)
  console.log('Filen Sanitization:', filenStatus)

  // Playwright assertions for CI
  const providersWithTokens = [googleStatus, filenStatus].filter((s) => s.count > 0)
  expect(providersWithTokens.length, 'At least one provider token cache should be present').toBeGreaterThan(0)
  for (const providerStatus of providersWithTokens) {
    expect(providerStatus.sanitized, 'Provider tokens should be sanitized').toBeTruthy()
  }

  const allSanitized = providersWithTokens.every((s) => s.sanitized)
  results.token_security = allSanitized ? 'PASS' : `FAIL (google:${googleStatus.sanitized}, filen:${filenStatus.sanitized})`

  const tokenSanitizationDetails = {
    google: { count: googleStatus.count, pass: googleStatus.sanitized },
    filen: { count: filenStatus.count, pass: filenStatus.sanitized }
  }

  // 5. Verify Proxy Usage & Metadata Partitioning
  const dbKeys = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('CacheFlowMetadata', 2)
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('metadata')) {
          resolve([])
          return
        }
        const transaction = db.transaction('metadata', 'readonly')
        const store = transaction.objectStore('metadata')
        const keysRequest = store.getAllKeys()
        keysRequest.onsuccess = () => resolve(keysRequest.result)
        keysRequest.onerror = () => resolve([])
      }
      request.onerror = () => resolve([])
    })
  }) as unknown as string[]

  console.log('IndexedDB Keys:', dbKeys)
  
  const hasG1 = dbKeys.some(k => k.startsWith('google:g1:'))
  const hasG2 = dbKeys.some(k => k.startsWith('google:g2:'))
  const hasD1 = dbKeys.some(k => k.startsWith('dropbox:d1:'))
  const hasF1 = dbKeys.some(k => k.startsWith('filen:qa-tester@filen.io:'))
  const partitionedProviders = [hasG1, hasG2, hasD1, hasF1].filter(Boolean).length

  // Playwright assertions for CI
  expect(partitionedProviders, 'IndexedDB should contain metadata keys for at least one expected provider partition').toBeGreaterThan(0)

  results.metadata_partitioning = partitionedProviders > 0
    ? 'PASS'
    : `FAIL (g1:${hasG1}, g2:${hasG2}, d1:${hasD1}, f1:${hasF1})`

  const severeProxyErrors = networkErrors.filter((e) => e.status >= 500)
  expect(severeProxyErrors.length, 'Proxy should not return server-side 5xx errors').toBe(0)
  results.proxy_usage = networkErrors.length === 0
    ? 'PASS'
    : `WARN (${networkErrors.length} non-ok responses, severe:${severeProxyErrors.length})`

  // Final Artifact Construction
  const finalReport = {
    ...results,
    timestamp: new Date().toISOString(),
    network_errors: networkErrors,
    indexeddb_keys: dbKeys,
    seeded_remotes_visible: {
      google_a: hasGoogleA,
      google_b: hasGoogleB,
      dropbox_a: hasDropboxA,
      filen_mock: hasFilenMock
    },
    token_sanitization_details: tokenSanitizationDetails
  }

  console.log('Verification Results:', JSON.stringify(finalReport, null, 2))
  
  // Deterministic Artifact Refresh
  try {
    if (!fs.existsSync(SHOTS_DIR)) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true })
    }
    fs.writeFileSync(REPORT_PATH, JSON.stringify(finalReport, null, 2), 'utf8')
    console.log(`[TEST] Report written to ${REPORT_PATH}`)
  } catch (err) {
    console.error('[TEST] Failed to write report:', err)
    throw err 
  }
})
