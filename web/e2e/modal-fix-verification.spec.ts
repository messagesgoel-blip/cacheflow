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

  await page.route('https://www.googleapis.com/drive/v3/files**', async (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    if (url.includes('alt=media')) {
      await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream' }, body: 'hello' })
      return
    }
    if (req.method() === 'PATCH') {
      googleFiles = [{ id: 'g1', name: 'Renamed.txt', mimeType: 'text/plain', size: '1024', modifiedTime: new Date().toISOString() }]
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(googleFiles[0]) })
      return
    }
    await route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ files: googleFiles, nextPageToken: null }),
    })
  })

  // Mock Google Upload
  await page.route('https://www.googleapis.com/upload/drive/v3/files**', async (route) => {
    await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ id: 'g2', name: 'Copy.txt' }) })
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

  await page.goto('/files', { waitUntil: 'networkidle' })
  await expect(page.getByText('VerifyMe.txt').first()).toBeVisible()

  const row = page.locator('tr').filter({ hasText: 'VerifyMe.txt' }).first()
  const renameBtn = row.getByTitle('Rename')
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
  
  // Immediately click another action to verify no intercepting overlay
  await expect(page.getByText('Renamed.txt').first()).toBeVisible()
  const newRow = page.locator('tr').filter({ hasText: 'Renamed.txt' }).first()
  await newRow.getByTitle('Rename').click() // This will fail if overlay still exists
  await expect(modalOverlay).toBeVisible()
  await modalOverlay.getByText('Cancel').click()

  // --- 3. Test ActionLogger Correlation ---
  // Get the logs for the final (successful) rename attempt.
  // We know it's the one that has an 'action_success' event.
  const successLog = logs.find(l => l.actionName === 'rename' && l.event === 'action_success')
  expect(successLog, 'action_success should be logged').toBeDefined()
  const cid = successLog.correlationId
  expect(cid).toBeTruthy()

  const renameLogs = logs.filter(l => l.correlationId === cid)
  const openLog = renameLogs.find(l => l.event === 'modal_open')
  const startLog = renameLogs.find(l => l.event === 'action_start')
  const closeLog = renameLogs.find(l => l.event === 'modal_close')

  expect(openLog, 'modal_open should be logged with matching correlationId').toBeDefined()
  expect(startLog, 'action_start should be logged with matching correlationId').toBeDefined()
  expect(closeLog, 'modal_close should be logged with matching correlationId').toBeDefined()

  // --- 4. Test Transfer Modal Loading State ---
  // Mock a slow copy
  await page.route('https://www.googleapis.com/drive/v3/files/g1/copy', async (route) => {
    await new Promise(r => setTimeout(r, 1000))
    await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ id: 'g2', name: 'Copy.txt' }) })
  })

  const renamedRow = page.locator('tr').filter({ hasText: 'Renamed.txt' }).first()
  await renamedRow.getByTitle('Copy').click()
  const transferModal = page.getByTestId('transfer-modal-overlay')
  await expect(transferModal).toBeVisible()
  
  const copyBtn = transferModal.getByRole('button', { name: 'Copy here' })
  await copyBtn.click()
  
  // Verify loading state
  await expect(transferModal.getByRole('button', { name: 'Copying...' })).toBeVisible()
  await expect(transferModal.locator('select').first()).toBeDisabled()
  
  // Wait for unmount with longer timeout and check for errors if it fails
  try {
    await expect(transferModal).not.toBeVisible({ timeout: 10000 })
  } catch (e) {
    const errorText = await transferModal.innerText()
    console.log('Transfer Modal Error Text:', errorText)
    throw e
  }
})
