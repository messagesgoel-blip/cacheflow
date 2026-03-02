import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('Multi-account isolation: separate files and cache per account', async ({ page }, testInfo) => {
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

    localStorage.setItem(
      'cacheflow_tokens_google',
      JSON.stringify([
        {
          provider: 'google',
          accessToken: 'google-access-a',
          accountEmail: 'a@example.com',
          displayName: 'Account A',
          accountKey: 'key-a',
          disabled: false,
        },
        {
          provider: 'google',
          accessToken: 'google-access-b',
          accountEmail: 'b@example.com',
          displayName: 'Account B',
          accountKey: 'key-b',
          disabled: false,
        },
      ])
    )
  })

  // Mock Google Drive API with account-specific responses
  await page.route('https://www.googleapis.com/drive/v3/files**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const auth = req.headers()['authorization']
    const url = req.url()
    
    // Check which account is making the request
    if (auth === 'Bearer google-access-a') {
      if (url.includes('root') || !url.includes('q=')) {
        // Root listing for A
        await route.fulfill({
          status: 200,
          headers: { ...cors, 'content-type': 'application/json' },
          body: JSON.stringify({
            files: [
              { id: 'folder-a', name: 'Folder A', mimeType: 'application/vnd.google-apps.folder', modifiedTime: new Date().toISOString() },
              { id: 'file-a', name: 'File from A.txt', mimeType: 'text/plain', size: '100', modifiedTime: new Date().toISOString() }
            ],
            nextPageToken: null
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers: { ...cors, 'content-type': 'application/json' },
          body: JSON.stringify({ files: [], nextPageToken: null }),
        })
      }
    } else if (auth === 'Bearer google-access-b') {
      if (url.includes('root') || !url.includes('q=')) {
        // Root listing for B
        await route.fulfill({
          status: 200,
          headers: { ...cors, 'content-type': 'application/json' },
          body: JSON.stringify({
            files: [
              { id: 'folder-b', name: 'Folder B', mimeType: 'application/vnd.google-apps.folder', modifiedTime: new Date().toISOString() },
              { id: 'file-b', name: 'File from B.txt', mimeType: 'text/plain', size: '200', modifiedTime: new Date().toISOString() }
            ],
            nextPageToken: null
          }),
        })
      } else if (url.includes('folder-b')) {
        // Children of Folder B
        await route.fulfill({
          status: 200,
          headers: { ...cors, 'content-type': 'application/json' },
          body: JSON.stringify({
            files: [
              { id: 'child-b', name: 'Child of B.txt', mimeType: 'text/plain', size: '50', modifiedTime: new Date().toISOString() }
            ],
            nextPageToken: null
          }),
        })
      } else {
        await route.fulfill({ status: 404, headers: cors })
      }
    } else {
      await route.fulfill({ status: 200, body: '{"files":[]}' }) // Allow local storage etc
    }
  })

  // --- Start UI ---
  await page.goto('/files')
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  
  // 1. Verify "All Files" shows both accounts
  await page.getByTestId('cf-sidebar-node-all-files').click()
  await expect(page.locator('tr').filter({ hasText: 'Account A' }).first()).toBeVisible({ timeout: 10000 })
  await expect(page.locator('tr').filter({ hasText: 'Account B' }).first()).toBeVisible({ timeout: 10000 })
  
  await expect(page.getByText('File from A.txt').first()).toBeVisible()
  await expect(page.getByText('File from B.txt').first()).toBeVisible()
  
  await page.screenshot({ path: shotPath(id, 'multi_account_all_view'), fullPage: true })

  // 2. Click folder from Account B and verify isolation
  const folderB = page.locator('tr').filter({ hasText: 'Folder B' }).first()
  await folderB.click()
  
  // Should now be in Account B specific view (verified by Sidebar highlight)
  await expect(page.getByTestId('cf-sidebar-account-key-b')).toHaveClass(/bg-blue-50/)
  
  // Verify children of B are loaded
  await expect(page.getByText('Child of B.txt').first()).toBeVisible({ timeout: 10000 })
  // Verify A's files are NOT visible
  await expect(page.getByText('File from A.txt').first()).not.toBeVisible()
  
  await page.screenshot({ path: shotPath(id, 'account_b_navigation'), fullPage: true })

  // 3. Cache isolation test: Switch to Account A via Sidebar and verify different files load
  await page.getByTestId('cf-sidebar-account-key-a').click()
  
  await expect(page.getByText('File from A.txt').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('File from B.txt').first()).not.toBeVisible()
  
  await page.screenshot({ path: shotPath(id, 'account_a_switch'), fullPage: true })
  
  // 4. Verification: Back to All Files and check duplication + isolation again
  await page.getByTestId('cf-sidebar-node-all-files').click()
  await expect(page.getByText('File from A.txt').first()).toBeVisible()
  await expect(page.getByText('File from B.txt').first()).toBeVisible()
})
