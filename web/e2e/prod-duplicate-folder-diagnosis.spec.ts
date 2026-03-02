import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('prod diagnosis: duplicate folders + empty folder from account mismatch', async ({ page }, testInfo) => {
  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`))
  const id = runId(testInfo.workerIndex)
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
  }

  // Two different Google accounts
  await page.addInitScript(() => {
    localStorage.setItem('cf_token', 'test-token')
    localStorage.setItem('cf_email', 'test@example.com')
    localStorage.setItem('cacheflow_tokens_google', JSON.stringify([
      { provider: 'google', accessToken: 'g1', accountEmail: 'g1@example.com', displayName: 'Google A', accountKey: 'g1' },
      { provider: 'google', accessToken: 'g2', accountEmail: 'g2@example.com', displayName: 'Google B', accountKey: 'g2' },
    ]))
  })

  const googleCalls: Array<{ account: string; parent: string }> = []

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('localhost:3010') || url.includes('127.0.0.1:3010')) return route.continue()
    
    if (url.includes('/proxy')) {
      const req = route.request()
      const body = req.postDataJSON()
      const auth = req.headers()['authorization']
      const proxyUrl = body.url || ''
      const remoteId = url.split('/').slice(-2)[0]
      
      const account = remoteId === 'g1' || proxyUrl.includes('accessToken=g1') ? 'g1' : 'g2'
      googleCalls.push({ account, parent: proxyUrl.split('q=')[1] || 'root' })

      if (account === 'g1') {
        if (proxyUrl.includes('root') || !proxyUrl.includes('q=')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'g1-docs', name: 'Documents', mimeType: 'application/vnd.google-apps.folder' }] }) })
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) })
        }
      } else {
        if (proxyUrl.includes('root') || !proxyUrl.includes('q=')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'g2-docs', name: 'Documents', mimeType: 'application/vnd.google-apps.folder' }] }) })
        } else if (proxyUrl.includes('g2-docs')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'g2-f1', name: 'g2-budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: '1500' }] }) })
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) })
        }
      }
      return
    }

    if (url.startsWith('https://')) return route.fulfill({ status: 200, body: '{}' })
    return route.continue()
  })

  await page.goto('/files')
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await page.getByTestId('cf-sidebar-node-all-files').click()
  await expect(page.getByText('Documents').first()).toBeVisible({ timeout: 20_000 })

  const docsCount = await page.locator('tr', { hasText: 'Documents' }).count()
  console.log(`[TEST] Documents count: ${docsCount}`)
  await page.screenshot({ path: shotPath(id, 'root_duplicate_documents_rows'), fullPage: true })

  // Click Documents row that belongs to g2 account.
  const g2DocsRow = page.locator('tr', { hasText: 'Documents' }).filter({ hasText: /Google B|g2/i }).first()
  await expect(g2DocsRow).toBeVisible()
  await g2DocsRow.click()
  await page.waitForTimeout(2000)

  await page.screenshot({ path: shotPath(id, 'after_click_g2_documents_row'), fullPage: true })

  // UI should now correctly switch to g2 account in sidebar
  await expect(page.getByTestId('cf-sidebar-account-g2')).toHaveClass(/bg-blue-50/)

  const filesVisible = await page.getByText('g2-budget.xlsx').first().isVisible().catch(() => false)
  console.log(`[TEST] filesVisible: ${filesVisible}`)

  expect(docsCount).toBeGreaterThan(1)
  expect(filesVisible).toBeTruthy()
})
