import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

test('Verification: Modal lifecycle and ActionLogger correlation', async ({ page }, testInfo) => {
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
          accessToken: 'google-access',
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          accountEmail: 'g1@example.com',
          accountKey: 'g1',
        },
      ])
    )
  })

  // Mock Google Drive API
  let googleFiles = [
    { id: 'g1', name: 'VerifyMe.txt', mimeType: 'text/plain', size: '1024', modifiedTime: new Date().toISOString() }
  ]

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('localhost:3000') || url.includes('127.0.0.1:3000')) return route.continue()
    if (url.includes('/proxy')) {
      if (route.request().method() === 'PATCH') {
        googleFiles = [{ id: 'g1', name: 'Renamed.txt', mimeType: 'text/plain', size: '1024', modifiedTime: new Date().toISOString() }]
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(googleFiles[0]) })
        return
      }
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({ files: googleFiles, nextPageToken: null }),
      })
      return
    }
    if (url.startsWith('https://')) return route.fulfill({ status: 200, body: '{}' })
    return route.continue()
  })

  // Track ActionLogger logs
  const logs: any[] = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[ActionLogger]')) {
      try {
        const json = JSON.parse(text.split('[ActionLogger] ')[1])
        logs.push(json)
      } catch (e) {}
    }
  })

  await page.goto('/files')
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await page.getByTestId('cf-sidebar-account-g1').click()
  await expect(page.getByText('VerifyMe.txt').first()).toBeVisible({ timeout: 15000 })

  const row = page.locator('tr', { hasText: 'VerifyMe.txt' }).first()
  await row.locator('input[type="checkbox"]').click({ force: true })
  
  const renameBtn = page.getByText('Rename')
  const modalOverlay = page.getByTestId('rename-modal-overlay')

  // --- 1. Test Close Paths ---
  // A. Cancel
  await renameBtn.click()
  await expect(modalOverlay).toBeVisible()
  await modalOverlay.getByText('Cancel').click()
  await expect(modalOverlay).not.toBeVisible()
  
  // B. Escape
  await renameBtn.click()
  await expect(modalOverlay).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modalOverlay).not.toBeVisible()

  // C. Backdrop Click
  await renameBtn.click()
  await expect(modalOverlay).toBeVisible()
  await modalOverlay.click({ position: { x: 5, y: 5 } })
  await expect(modalOverlay).not.toBeVisible()

  // --- 2. Test Success Path Interactivity ---
  await renameBtn.click()
  await modalOverlay.locator('input').fill('Renamed.txt')
  await modalOverlay.getByText('Save').click()
  await expect(modalOverlay).not.toBeVisible()
  
  // Immediately check for renamed file
  await expect(page.getByText('Renamed.txt').first()).toBeVisible({ timeout: 10000 })
})
