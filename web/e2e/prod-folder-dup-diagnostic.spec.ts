import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('prod diagnostic: duplicate folders with 4 drives and nested files', async ({ page }, testInfo) => {
  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`))
  const id = runId(testInfo.workerIndex)
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
  }

  await page.addInitScript(() => {
    localStorage.setItem('cf_token', 'test-token')
    localStorage.setItem('cf_email', 'test@example.com')
    
    localStorage.setItem('cacheflow_tokens_google', JSON.stringify([
      { provider: 'google', accessToken: 'g1', accountEmail: 'g1@example.com', displayName: 'Google A', accountKey: 'g1' },
      { provider: 'google', accessToken: 'g2', accountEmail: 'g2@example.com', displayName: 'Google B', accountKey: 'g2' },
    ]))
    localStorage.setItem('cacheflow_tokens_dropbox', JSON.stringify([
      { provider: 'dropbox', accessToken: 'd1', accountEmail: 'd1@example.com', displayName: 'Dropbox A', accountKey: 'd1' },
      { provider: 'dropbox', accessToken: 'd2', accountEmail: 'd2@example.com', displayName: 'Dropbox B', accountKey: 'd2' },
    ]))
  })

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('localhost:3010') || url.includes('127.0.0.1:3010')) return route.continue()
    
    if (url.includes('/proxy')) {
      const req = route.request()
      const body = req.postDataJSON()
      const auth = req.headers()['authorization']
      const proxyUrl = body.url || ''
      const remoteId = url.split('/').slice(-2)[0]
      
      const provider = proxyUrl.includes('dropbox') ? 'dropbox' : 'google'
      
      if (provider === 'google') {
        const account = remoteId === 'g1' || proxyUrl.includes('accessToken=g1') ? 'g1' : 'g2'
        const files = proxyUrl.includes('docs') 
          ? [{ id: `${account}-f1`, name: `${account}-file.txt`, mimeType: 'text/plain', size: '100' }]
          : [{ id: `${account}-docs`, name: 'Documents', mimeType: 'application/vnd.google-apps.folder' }]
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files }) })
      } else {
        const account = remoteId === 'd1' || proxyUrl.includes('accessToken=d1') ? 'd1' : 'd2'
        const entries = (proxyUrl.includes('docs') || proxyUrl.includes('list_folder/continue'))
          ? [{ '.tag': 'file', id: `id:${account}-f1`, name: `${account}-file.txt`, size: 100 }]
          : [{ '.tag': 'folder', id: `id:${account}-docs`, name: 'Documents', path_lower: `/${account}-docs` }]
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries, has_more: false, cursor: 'c' }) })
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

  const rootDocsCount = await page.locator('tr', { hasText: 'Documents' }).count()
  console.log(`[TEST] rootDocsCount: ${rootDocsCount}`)
  await page.screenshot({ path: shotPath(id, 'root_duplicates'), fullPage: true })

  const probes = [
    { key: 'google_g2_docs', rowHas: ['Documents', /Google B|g2/i], sidebarId: 'cf-sidebar-account-g2' },
    { key: 'google_g1_docs', rowHas: ['Documents', /Google A|g1/i], sidebarId: 'cf-sidebar-account-g1' },
    { key: 'dropbox_d2_docs', rowHas: ['Documents', /Dropbox B|d2/i], sidebarId: 'cf-sidebar-account-d2' },
    { key: 'dropbox_d1_docs', rowHas: ['Documents', /Dropbox A|d1/i], sidebarId: 'cf-sidebar-account-d1' },
  ]

  const outcomes: any[] = []

  for (const probe of probes) {
    console.log(`[TEST] Probing ${probe.key}...`)
    await page.getByTestId('cf-sidebar-node-all-files').click()
    let row = page.locator('tr', { hasText: probe.rowHas[0] })
    for (const h of probe.rowHas.slice(1)) { row = row.filter({ hasText: h }) }
    
    await expect(row.first()).toBeVisible({ timeout: 10000 })
    await row.first().click()
    await page.waitForTimeout(2000)

    // Sidebar should highlight the correct account
    await expect(page.getByTestId(probe.sidebarId)).toHaveClass(/bg-blue-50/)
    
    const fileRows = await page.locator('tbody tr').count().catch(() => 0)
    console.log(`[TEST] ${probe.key} fileRows=${fileRows}`)

    outcomes.push({ probe: probe.key, found: true, fileRows })
    await page.screenshot({ path: shotPath(id, `after_click_${probe.key}`), fullPage: true })
  }

  expect(rootDocsCount).toBeGreaterThan(1)
  for (const outcome of outcomes) {
    expect(outcome.found).toBe(true)
    expect(outcome.fileRows).toBeGreaterThan(0)
  }
})
