import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('copy between providers via transfer modal', async ({ page }, testInfo) => {
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
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'g-file-1', name: 'Budget 2026.xlsx', mimeType: 'text/plain', size: '5', modifiedTime: new Date().toISOString() }] }) })
        return
      }
      if (proxyUrl.includes('dropbox') && proxyUrl.includes('list_folder')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [{ '.tag': 'folder', name: 'Dest', path_lower: '/dest', id: 'id:dest' }] }) })
        return
      }
      if (proxyUrl.includes('upload')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'id:uploaded', name: 'Budget 2026.xlsx' }) })
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
  
  await page.getByTestId('cf-sidebar-account-g1').click()
  await expect(page.getByText('Budget 2026.xlsx').first()).toBeVisible({ timeout: 15_000 })

  const budgetRow = page.locator('tr', { hasText: 'Budget 2026.xlsx' })
  await budgetRow.locator('input[type="checkbox"]').click({ force: true })
  
  await page.getByText('Copy').click()
  await expect(page.getByText('Copy file')).toBeVisible()
  
  await page.selectOption('select[aria-label="Target provider"]', 'dropbox')
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /dest/i }).click()
  await page.getByRole('button', { name: /copy here/i }).click()

  const queuePanel = page.getByTestId('cf-transfer-queue-panel')
  await expect(queuePanel).toBeVisible({ timeout: 10000 })
  await expect(queuePanel).toContainText(/copying|completed/i, { timeout: 30000 })
})
