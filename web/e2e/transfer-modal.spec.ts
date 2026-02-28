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
  const started: string[] = []
  const finished: string[] = []
  const failed: Array<{ url: string; error: string }> = []
  let dropboxUploadHits = 0

  page.on('request', (r) => {
    const url = r.url()
    if (url.startsWith('https://www.googleapis.com/') || url.startsWith('https://api.dropboxapi.com/') || url.startsWith('https://content.dropboxapi.com/')) {
      started.push(`${r.method()} ${url}`)
    }
  })
  page.on('requestfinished', (r) => {
    const url = r.url()
    if (url.startsWith('https://www.googleapis.com/') || url.startsWith('https://api.dropboxapi.com/') || url.startsWith('https://content.dropboxapi.com/')) {
      finished.push(`${r.method()} ${url}`)
    }
  })
  page.on('requestfailed', (r) => {
    const url = r.url()
    if (url.startsWith('https://www.googleapis.com/') || url.startsWith('https://api.dropboxapi.com/') || url.startsWith('https://content.dropboxapi.com/')) {
      failed.push({ url: `${r.method()} ${url}`, error: r.failure()?.errorText || 'failed' })
    }
  })
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.error('[pageerror]', err.message)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // eslint-disable-next-line no-console
      console.error('[console]', msg.text())
    }
  })
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,dropbox-api-arg',
  }
  await page.addInitScript(() => {
    localStorage.setItem('cf_token', 'test-token')
    localStorage.setItem('cf_email', 'test@example.com')

    const googleTokens = [
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
    ]
    const dropboxTokens = [
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
    ]
    localStorage.setItem('cacheflow_tokens_google', JSON.stringify(googleTokens))
    localStorage.setItem('cacheflow_tokens_dropbox', JSON.stringify(dropboxTokens))
  })

  // Block unknown external calls early
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

  // Google Drive list & download
  await page.route('https://www.googleapis.com/drive/v3/files**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const url = route.request().url()
    if (url.includes('alt=media')) {
      await route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'text/plain' },
        body: 'hello',
      })
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
          entries: [
            { '.tag': 'folder', name: 'Dest', path_lower: '/dest', path_display: '/Dest' },
          ],
          cursor: 'c',
          has_more: false,
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ entries: [], cursor: 'c2', has_more: false }),
    })
  })

  await page.route('https://content.dropboxapi.com/2/files/upload**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    dropboxUploadHits += 1
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

  await page.screenshot({ path: shotPath(id, 'files_loaded_copy'), fullPage: true })

  // Sanity: tokens should be present
  const keys = await page.evaluate(() => Object.keys(localStorage))
  expect(keys).toContain('cacheflow_tokens_google')
  expect(keys).toContain('cacheflow_tokens_dropbox')
  const googleRaw = await page.evaluate(() => localStorage.getItem('cacheflow_tokens_google'))
  expect(googleRaw).toContain('google-access')

  // Wait file row to render
  await expect(page.getByText('Budget 2026.xlsx').first()).toBeVisible({ timeout: 15_000 })

  // Click inline Copy icon
  const budgetRow = page.locator('tr', { hasText: 'Budget 2026.xlsx' })
  await budgetRow.locator('button[title="Copy"]').click()

  await page.screenshot({ path: shotPath(id, 'transfer_modal_open_copy'), fullPage: true })

  await expect(page.getByText('Copy file')).toBeVisible()

  // Choose target provider Dropbox
  await page.locator('select[aria-label="Target provider"]').selectOption('dropbox')
  await page.screenshot({ path: shotPath(id, 'transfer_modal_dropbox_selected_copy'), fullPage: true })

  // Click Dest folder
  await page.getByRole('button', { name: /dest/i }).click()
  await page.screenshot({ path: shotPath(id, 'transfer_modal_dest_selected_copy'), fullPage: true })

  // Copy here
  await page.getByRole('button', { name: /copy here/i }).click()

  await page.screenshot({ path: shotPath(id, 'copy_initiated'), fullPage: true })

  const bannerBox = page.locator('div.fixed.top-4.right-4')

  // Banner appears and operation completes (fast mocks may skip the in-progress title)
  await expect(bannerBox).toBeVisible({ timeout: 10_000 })
  await expect(bannerBox).toContainText(/copying file|copied/i, { timeout: 10_000 })

  try {
    // Wait for the progress bar to disappear (task completed)
    await expect(bannerBox.locator('div.mt-2.h-2')).toHaveCount(0, { timeout: 20_000 })
  } catch (e) {
    const pending = started.filter((s) => !finished.includes(s))
    const snapshot = (await bannerBox.innerText().catch(() => ''))
    throw new Error(
      [
        'Copy operation did not complete in time.',
        `Pending requests (${pending.length}):`,
        ...pending.slice(0, 20),
        `Failed requests (${failed.length}):`,
        ...failed.slice(0, 20).map((f) => `${f.url} -> ${f.error}`),
        'Banners:',
        snapshot.trim(),
      ].join('\n')
    )
  }

  const finalText = (await bannerBox.innerText()).trim()
  if (!/copied/i.test(finalText)) {
    const pending = started.filter((s) => !finished.includes(s))
    throw new Error(
      [
        'Copy did not succeed.',
        `Dropbox upload mock hits: ${dropboxUploadHits}`,
        `Pending requests (${pending.length}):`,
        ...pending.slice(0, 20),
        `Failed requests (${failed.length}):`,
        ...failed.slice(0, 20).map((f) => `${f.url} -> ${f.error}`),
        'Banners:',
        finalText,
      ].join('\n')
    )
  }

  await expect(page.getByText('Copy file')).toHaveCount(0)
})
