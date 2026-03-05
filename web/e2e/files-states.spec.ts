import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('files page loading/empty/loaded screenshots', async ({ page }, testInfo) => {
  const id = runId(testInfo.workerIndex)

  await page.addInitScript(() => {
    localStorage.setItem('cf_token', 'test-token')
    localStorage.setItem('cf_email', 'test@example.com')

    localStorage.setItem('cacheflow_tokens_google', JSON.stringify([
      {
        provider: 'google',
        accessToken: 'google-access',
        refreshToken: 'google-refresh',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        accountEmail: 'username@gmail.com',
        displayName: 'User Google',
        accountId: 'g1',
        accountKey: 'g1',
        disabled: false,
      },
    ]))
  })

  // Route Google list files with a deliberate delay first (to capture loading)
  let mode: 'delayed-empty' | 'loaded' = 'delayed-empty'

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('localhost:3010') || url.includes('127.0.0.1:3010')) {
      await route.continue()
      return
    }
    // Handle Google Drive proxy
    if (url.includes('/proxy')) {
      if (mode === 'delayed-empty') {
        await new Promise((r) => setTimeout(r, 2000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [], nextPageToken: null }),
        })
        mode = 'loaded'
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [
            {
              id: 'g-file-1',
              name: 'Hello.txt',
              mimeType: 'text/plain',
              size: '5',
              modifiedTime: new Date().toISOString(),
              createdTime: new Date().toISOString(),
            },
          ],
          nextPageToken: null,
        }),
      })
      return
    }
    
    if (url.startsWith('https://www.googleapis.com/')) {
      await route.fulfill({ status: 200, body: '{}' })
      return
    }
    await route.abort()
  })

  // 1. Loading state screenshot
  await page.goto('/files')
  await page.waitForSelector('[data-testid="cf-sidebar-root"]')
  
  // Navigate to Google Drive A to trigger the proxied request
  await page.getByTestId('cf-sidebar-account-g1').click()
  
  await page.waitForTimeout(500)
  await page.screenshot({ path: shotPath(id, 'files_loading_state'), fullPage: true })

  // 2. Empty state screenshot
  await expect(page.getByText('This folder is empty')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: shotPath(id, 'files_empty_state'), fullPage: true })

  // 3. Loaded state screenshot (after refresh)
  await page.getByTestId('files-refresh').click()
  await expect(page.getByText('Hello.txt').first()).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: shotPath(id, 'files_loaded_state'), fullPage: true })
})
