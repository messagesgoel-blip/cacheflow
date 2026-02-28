import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('move between providers via transfer modal', async ({ page }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,dropbox-api-arg',
  }

  await page.addInitScript(() => {
    localStorage.setItem('cf_token', 'test-token')
    localStorage.setItem('cf_email', 'test@example.com')

    localStorage.setItem('cacheflow_tokens_google', JSON.stringify([
      {
        provider: 'google',
        accessToken: 'google-access',
        refreshToken: 'google-refresh',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        accountEmail: 'g1@example.com',
        displayName: 'Google One',
        accountId: 'g1',
        accountKey: 'g1',
        disabled: false,
      },
    ]))

    localStorage.setItem('cacheflow_tokens_dropbox', JSON.stringify([
      {
        provider: 'dropbox',
        accessToken: 'dropbox-access',
        refreshToken: 'dropbox-refresh',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        accountEmail: 'd1@example.com',
        displayName: 'Dropbox One',
        accountId: 'd1',
        accountKey: 'd1',
        disabled: false,
      },
    ]))
  })

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (
      url.startsWith('http://localhost:3010') ||
      url.startsWith('http://127.0.0.1:3010') ||
      url.startsWith('http://localhost:4010') ||
      url.startsWith('http://127.0.0.1:4010')
    ) {
      await route.continue()
      return
    }
    if (url.startsWith('https://www.googleapis.com/') || url.startsWith('https://api.dropboxapi.com/') || url.startsWith('https://content.dropboxapi.com/')) {
      await route.continue()
      return
    }
    await route.abort()
  })

  // Google Drive list, metadata, download, delete
  await page.route('https://www.googleapis.com/drive/v3/files**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const url = route.request().url()
    const method = route.request().method()

    if (method === 'DELETE') {
      await route.fulfill({ status: 204, headers: cors, body: '' })
      return
    }

    if (url.includes('fields=size,mimeType')) {
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({ size: '5', mimeType: 'text/plain' }),
      })
      return
    }

    if (url.includes('alt=media')) {
      await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/plain' }, body: 'hello' })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        files: [
          {
            id: 'g-file-1',
            name: 'Budget 2026.xlsx',
            mimeType: 'text/plain',
            size: '5',
            modifiedTime: new Date().toISOString(),
            createdTime: new Date().toISOString(),
          },
        ],
        nextPageToken: null,
      }),
    })
  })

  // Dropbox folder list + upload
  await page.route('https://api.dropboxapi.com/2/files/list_folder**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const body = route.request().postData() || ''
    const req = body ? JSON.parse(body) : { path: '' }
    const path = req.path || ''
    if (!path) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          entries: [{ '.tag': 'folder', name: 'Dest', path_lower: '/dest', path_display: '/Dest' }],
          cursor: 'c',
          has_more: false,
        }),
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ entries: [], cursor: 'c2', has_more: false }) })
  })

  await page.route('https://content.dropboxapi.com/2/files/upload**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        name: 'Budget 2026.xlsx',
        path_lower: '/dest/budget 2026.xlsx',
        path_display: '/Dest/Budget 2026.xlsx',
        id: 'id:uploaded',
        size: 5,
        server_modified: new Date().toISOString(),
        client_modified: new Date().toISOString(),
      }),
    })
  })

  await page.goto('/files')
  await page.screenshot({ path: shotPath(id, 'files_loaded_move'), fullPage: true })
  await expect(page.getByText('Budget 2026.xlsx').first()).toBeVisible({ timeout: 15_000 })

  // Click inline Move icon (on the file row, not the folder row)
  const budgetRow = page.locator('tr', { hasText: 'Budget 2026.xlsx' })
  await budgetRow.locator('button[title="Move"]').click()
  await page.screenshot({ path: shotPath(id, 'transfer_modal_open_move'), fullPage: true })
  await expect(page.getByText('Move file')).toBeVisible()
  await page.locator('select[aria-label="Target provider"]').selectOption('dropbox')
  await page.screenshot({ path: shotPath(id, 'transfer_modal_dropbox_selected_move'), fullPage: true })
  await page.getByRole('button', { name: /dest/i }).click()
  await page.screenshot({ path: shotPath(id, 'transfer_modal_dest_selected_move'), fullPage: true })
  await page.getByRole('button', { name: /move here/i }).click()
  await page.screenshot({ path: shotPath(id, 'move_initiated'), fullPage: true })

  // Wait for completion via banner: progress bar disappears then banner contains "Moved"
  const bannerBox = page.locator('div.fixed.top-4.right-4')
  await expect(bannerBox).toBeVisible({ timeout: 10_000 })
  await expect(bannerBox).toContainText(/moving file|moved/i, { timeout: 10_000 })
  await expect(bannerBox.locator('div.mt-2.h-2')).toHaveCount(0, { timeout: 20_000 })
  const finalText = (await bannerBox.innerText()).trim()
  if (!/moved/i.test(finalText)) {
    throw new Error(finalText)
  }
})
