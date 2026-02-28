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

    localStorage.setItem(
      'cacheflow_tokens_google',
      JSON.stringify([
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
      ])
    )
    localStorage.setItem(
      'cacheflow_tokens_dropbox',
      JSON.stringify([
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
      ])
    )
  })

  // Block unknown external calls early
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.startsWith('http://localhost:3010') || url.startsWith('http://127.0.0.1:3010')) {
      await route.continue()
      return
    }
    if (
      url.startsWith('https://www.googleapis.com/') ||
      url.startsWith('https://api.dropboxapi.com/') ||
      url.startsWith('https://content.dropboxapi.com/')
    ) {
      await route.continue()
      return
    }
    await route.abort()
  })

  // --- Google state + routes ---
  const gNow = new Date().toISOString()
  let googleFiles: Array<{ id: string; name: string; mimeType: string; size: string; modifiedTime?: string; createdTime?: string }> = [
    {
      id: 'g-xlsx',
      name: 'Budget 2026.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: '5',
      modifiedTime: gNow,
      createdTime: gNow,
    },
    {
      id: 'g-pdf',
      name: 'Report.pdf',
      mimeType: 'application/pdf',
      size: '8',
      modifiedTime: gNow,
      createdTime: gNow,
    },
    {
      id: 'g-png',
      name: 'Logo.png',
      mimeType: 'image/png',
      size: '12',
      modifiedTime: gNow,
      createdTime: gNow,
    },
  ]
  const googleDeleted: string[] = []

  await page.route('https://www.googleapis.com/drive/v3/files**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const url = req.url()
    const method = req.method()

    // Download
    if (url.includes('alt=media')) {
      await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream' }, body: 'file-bytes' })
      return
    }

    // Delete
    if (method === 'DELETE') {
      const m = url.match(/\/drive\/v3\/files\/([^?]+)/)
      const id = m?.[1]
      if (id) {
        googleDeleted.push(id)
        googleFiles = googleFiles.filter((f) => f.id !== id)
      }
      await route.fulfill({ status: 204, headers: cors, body: '' })
      return
    }

    // Metadata lookup (file-specific): /drive/v3/files/<id>?fields=...
    if (/\/drive\/v3\/files\//.test(url) && url.includes('fields=')) {
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({ size: '5', mimeType: 'application/octet-stream' }),
      })
      return
    }

    // List
    await route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ files: googleFiles, nextPageToken: null }),
    })
  })

  // --- Dropbox state + routes ---
  const dropboxDestFiles: Array<{ name: string; size: number; server_modified?: string; client_modified?: string }> = []

  await page.route('https://api.dropboxapi.com/2/files/list_folder**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const raw = route.request().postData() || ''
    const req = raw ? JSON.parse(raw) : { path: '' }
    const path = (req.path || '') as string
    const lower = path.toLowerCase()

    if (!path) {
      // Root: a folder + a file missing server_modified (exercises date fallback)
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({
          entries: [
            { '.tag': 'folder', name: 'Dest', path_lower: '/dest', path_display: '/Dest' },
            { '.tag': 'file', name: 'Notes.txt', path_lower: '/notes.txt', path_display: '/Notes.txt', id: 'id:notes', size: 1 },
          ],
          cursor: 'c',
          has_more: false,
        }),
      })
      return
    }

    if (lower === '/dest') {
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({
          entries: dropboxDestFiles.map((f) => ({
            '.tag': 'file',
            name: f.name,
            path_lower: `/dest/${f.name.toLowerCase()}`,
            path_display: `/Dest/${f.name}`,
            id: `id:${f.name}`,
            size: f.size,
            server_modified: f.server_modified,
            client_modified: f.client_modified,
          })),
          cursor: 'c2',
          has_more: false,
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ entries: [], cursor: 'cx', has_more: false }),
    })
  })

  await page.route('https://content.dropboxapi.com/2/files/upload**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const headers = route.request().headers()
    const argRaw = headers['dropbox-api-arg'] || headers['Dropbox-API-Arg']
    const arg = argRaw ? JSON.parse(argRaw) : null
    const path = (arg?.path || '') as string
    const name = path.split('/').pop() || 'uploaded'
    if (path.toLowerCase().startsWith('/dest/')) {
      dropboxDestFiles.push({ name, size: 5, server_modified: new Date().toISOString(), client_modified: new Date().toISOString() })
    }

    await route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        path_lower: path.toLowerCase(),
        path_display: path,
        id: `id:${name}`,
        size: 5,
        server_modified: new Date().toISOString(),
        client_modified: new Date().toISOString(),
      }),
    })
  })

  // --- Start UI ---
  await page.goto('/files', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Budget 2026.xlsx').first()).toBeVisible({ timeout: 15_000 })

  // Date fallback: Dropbox file without server_modified should not render "Invalid Date"
  await expect(page.getByText('Invalid Date')).toHaveCount(0)
  const notesRow = page.locator('tr', { hasText: 'Notes.txt' })
  await expect(notesRow).toBeVisible()
  await expect(notesRow.locator('td').nth(4)).toHaveText('—')

  await page.screenshot({ path: shotPath(id, 'mixed_provider_root'), fullPage: true })

  // Copy Budget -> Dropbox /Dest
  const budgetRow = page.locator('tr', { hasText: 'Budget 2026.xlsx' })
  await budgetRow.locator('button[title="Copy"]').click()
  await page.locator('select[aria-label="Target provider"]').selectOption('dropbox')
  await page.getByRole('button', { name: /Dest/i }).first().click()
  await page.getByRole('button', { name: /copy here/i }).click()

  const bannerBox = page.locator('div.fixed.top-4.right-4')
  await expect(bannerBox.getByText(/copying file/i)).toBeVisible({ timeout: 10_000 })
  await expect(bannerBox.locator('div.mt-2.h-2')).toHaveCount(0, { timeout: 20_000 })
  await expect(bannerBox).toContainText(/Copied/i)

  // Confirm destination contains the copied file
  await page.getByTestId('files-provider-filter').selectOption('dropbox')
  const destFolderRow = page.locator('tr', { hasText: '/Dest' }).first()
  await expect(destFolderRow).toBeVisible({ timeout: 10_000 })
  await destFolderRow.click()
  await expect(page.getByText('Budget 2026.xlsx').first()).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: shotPath(id, 'dropbox_dest_after_copy'), fullPage: true })

  // Move Report.pdf -> Dropbox /Dest
  await page.getByTestId('files-provider-filter').selectOption('all')
  await page.getByTestId('files-provider-filter').selectOption('google')
  await expect(page.getByText('Report.pdf').first()).toBeVisible({ timeout: 10_000 })
  const reportRow = page.locator('tr', { hasText: 'Report.pdf' })
  await reportRow.locator('button[title="Move"]').click()
  await page.locator('select[aria-label="Target provider"]').selectOption('dropbox')
  await page.getByRole('button', { name: /Dest/i }).first().click()
  await page.getByRole('button', { name: /move here/i }).click()

  await expect(bannerBox.getByText(/moving file/i)).toBeVisible({ timeout: 10_000 })
  await expect(bannerBox.locator('div.mt-2.h-2')).toHaveCount(0, { timeout: 20_000 })
  await expect(bannerBox).toContainText(/Moved/i)

  // Source should be deleted after move
  await expect(page.getByText('Report.pdf')).toHaveCount(0)
  expect(googleDeleted).toContain('g-pdf')

  // Destination should contain moved file
  await page.getByTestId('files-provider-filter').selectOption('dropbox')
  await page.locator('tr', { hasText: '/Dest' }).first().click()
  await expect(page.getByText('Report.pdf').first()).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: shotPath(id, 'dropbox_dest_after_move'), fullPage: true })
})
