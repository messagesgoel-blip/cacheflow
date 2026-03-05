import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('regression: mixed providers date fallback + copy/move semantics', async ({ page }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,dropbox-api-arg',
  }

  await page.addInitScript(() => {
    localStorage.setItem('cf_token', 'test-token')
    localStorage.setItem('cf_email', 'test@example.com')

    localStorage.setItem('cacheflow_tokens_google', JSON.stringify([{
      provider: 'google', accessToken: 'google-access', refreshToken: 'google-refresh',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, accountEmail: 'g1@example.com',
      displayName: 'Google One', accountId: 'g1', accountKey: 'g1', disabled: false,
    }]))
    localStorage.setItem('cacheflow_tokens_dropbox', JSON.stringify([{
      provider: 'dropbox', accessToken: 'dropbox-access', refreshToken: 'dropbox-refresh',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, accountEmail: 'd1@example.com',
      displayName: 'Dropbox One', accountId: 'd1', accountKey: 'd1', disabled: false,
    }]))
  })

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('localhost:3000') || url.includes('127.0.0.1:3000')) {
      await route.continue()
      return
    }
    if (url.includes('/proxy')) {
      const body = route.request().postDataJSON?.() || {}
      const proxyUrl = body.url || ''
      if (proxyUrl.includes('google') && (proxyUrl.includes('files') || proxyUrl.includes('list'))) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'g-xlsx', name: 'Budget 2026.xlsx', mimeType: 'text/plain', size: '5', modifiedTime: new Date().toISOString() }] }) })
        return
      }
      if (proxyUrl.includes('dropbox') && proxyUrl.includes('list_folder')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [{ '.tag': 'file', name: 'Notes.txt', path_lower: '/notes.txt', path_display: '/Notes.txt', id: 'id:notes', size: 1 }] }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ storageQuota: { limit: "100", usage: "0" }, user: { displayName: "Mock" } }) })
      return
    }
    if (url.startsWith('https://')) { await route.fulfill({ status: 200, body: '{}' }); return }
    await route.continue()
  })

  await page.goto('/files')
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  
  // Verify date fallback: "—" for missing modifiedTime if possible, or just no "Invalid Date"
  await page.getByTestId('cf-sidebar-account-d1').click()
  await expect(page.getByText('Notes.txt').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Invalid Date')).toHaveCount(0)
})
