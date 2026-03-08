import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('Server-side remotes: persistence and isolation on clean session', async ({ page }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-correlation-id',
  }

  page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`))
  
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    if (url.includes('/auth/login')) {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
        body: JSON.stringify({
          token: 'mock-token',
          user: { id: 'sup-id', email: 'sup@goels.in' }
        })
      })
      return
    }

    if (url.includes('/api/connections') && method === 'GET') {
      const response = {
        success: true,
        data: [
          {
            id: 'remote-google-a',
            provider: 'google',
            accountKey: 'g1',
            remoteId: 'remote-google-a',
            accountName: 'Google Drive A',
            accountEmail: 'g1@example.com',
            accountLabel: 'Google Drive A',
            isDefault: false,
            status: 'connected',
          },
          {
            id: 'remote-google-b',
            provider: 'google',
            accountKey: 'g2',
            remoteId: 'remote-google-b',
            accountName: 'Google Drive B',
            accountEmail: 'g2@example.com',
            accountLabel: 'Google Drive B',
            isDefault: false,
            status: 'connected',
          },
        ],
      }
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
        body: JSON.stringify(response)
      })
      return
    }
    
    if (url.includes('/proxy')) {
      const body = route.request().postDataJSON()
      const proxyUrl = body.url
      const remoteId = url.split('/').slice(-2)[0]

      if (proxyUrl.includes('files') || proxyUrl.includes('list')) {
        const account = remoteId === 'remote-google-a' || remoteId === 'f94d1b47-3749-470b-8d8b-f9dfce2d4917' ? 'A' : 'B'
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json', ...cors },
          body: JSON.stringify({
            files: [
              { id: `file-${account.toLowerCase()}`, name: `File from Google Drive ${account}.txt`, mimeType: 'text/plain', size: 100, modifiedTime: new Date().toISOString() }
            ],
            nextPageToken: null
          })
        })
        return
      }
    }

    if (url.includes('/api/')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, data: {} }) })
      return
    }

    if (url.startsWith('https://')) {
      await route.fulfill({ status: 200, body: '{}' })
      return
    }

    await route.continue()
  })

  // 2. Login
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await window.indexedDB.databases();
    for (const db of dbs) {
      if (db.name === 'CacheFlowMetadata') window.indexedDB.deleteDatabase(db.name);
    }
  })
  await page.reload()
  
  await page.waitForSelector('input[placeholder="Email"]')
  await page.fill('input[placeholder="Email"]', 'sup@goels.in')
  await page.fill('input[placeholder="Password"]', '123password')
  await page.click('button[type="submit"]')

  // Wait for navigation and app mount
  await page.waitForTimeout(3000)
  await page.goto('/files')
  
  // 3. Verify All Files (Sidebar node)
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await page.getByTestId('cf-sidebar-node-all-files').click()
  
  await page.screenshot({ path: shotPath(id, 'after_all_files_select') })
  await expect(page.getByTestId('cf-sidebar-account-g1')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('cf-sidebar-account-g2')).toBeVisible({ timeout: 15000 })
  
  await expect(page.getByText('File from Google Drive A.txt').first()).toBeVisible()
  await expect(page.getByText('File from Google Drive B.txt').first()).toBeVisible()

  await page.screenshot({ path: shotPath(id, 'server_side_remotes_final'), fullPage: true })

  // 4. Verify LocalStorage isolation
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage))
  const providerTokens = localStorageKeys.filter(k => k.startsWith('cacheflow_tokens_') && !k.endsWith('_local'))
  
  for (const key of providerTokens) {
    const data = await page.evaluate((k) => localStorage.getItem(k), key)
    const tokens = JSON.parse(data || '[]')
    for (const t of tokens) {
      // Tokens synced from server should NOT have accessToken in browser
      expect(t.accessToken, `Token for ${key} should be empty in localStorage`).toBe('')
      expect(t.remoteId, `Token for ${key} should have a remoteId`).toBeTruthy()
    }
  }
})

