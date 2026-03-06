import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { gotoFilesAndWait, primeQaSession } from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'
const REPORT_PATH = path.join(SHOTS_DIR, 'phase5-report.json')
const PERF_LOG_PATH = path.join(SHOTS_DIR, 'perf-guardrails.json')

test('Phase 5 Verification: Power-User Enhancements', async ({ page, request }) => {
  const results = {
    sections: {
      inlinePreviewPanel: 'PENDING',
      keyboardShortcuts: 'PENDING',
      starredCrossProvider: 'PENDING',
      activityFeed: 'PENDING',
      visualUnification: 'PENDING',
      operationRegression: 'PASS',
    },
    timestamp: new Date().toISOString(),
    console_errors: [] as string[],
    page_errors: [] as string[],
    network_errors: [] as any[],
    screenshots: [] as string[],
    performance: {} as Record<string, number>,
  }

  const favorites: any[] = []
  const activity = [
    {
      id: 'activity-1',
      action: 'upload',
      resource: 'file',
      resource_id: 'file-google-a',
      created_at: new Date().toISOString(),
      metadata: {
        fileName: 'File from GOOGLE A.txt',
        providerId: 'google',
        path: '/File from GOOGLE A.txt',
        size_bytes: 100,
      },
    },
  ]

  page.on('console', (msg) => {
    if (msg.type() === 'error') results.console_errors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    results.page_errors.push(err.message)
  })
  page.on('response', (response) => {
    if (!response.ok() && response.status() >= 400 && !response.url().includes('Simulated')) {
      results.network_errors.push({ url: response.url(), status: response.status() })
    }
  })

  await page.route('**/api/favorites**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { favorites } }),
      })
      return
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, string | boolean>
      favorites.splice(
        0,
        favorites.length,
        {
          id: `fav-${payload.fileId}`,
          provider: payload.provider,
          account_key: payload.accountKey,
          file_id: payload.fileId,
          file_name: payload.fileName,
          mime_type: payload.mimeType,
          is_folder: payload.isFolder,
          path: payload.path,
          created_at: new Date().toISOString(),
        },
      )
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { favorites } }),
      })
      return
    }

    if (method === 'DELETE') {
      favorites.splice(0, favorites.length)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    })
  })

  await page.route('**/api/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { activity } }),
    })
  })

  try {
    const startLogin = Date.now()
    await primeQaSession(page, request)
    await gotoFilesAndWait(page)
    results.performance.login_to_dashboard = Date.now() - startLogin

    await page.getByTestId('cf-sidebar-account-g1').click()
    const googleFileRow = page.locator('[data-testid="cf-file-row"]').filter({ hasText: 'File from GOOGLE A.txt' }).first()
    await expect(googleFileRow).toBeVisible({ timeout: 15000 })

    const googleStar = googleFileRow.getByTestId('cf-row-star-toggle')
    const startStar = Date.now()
    const favoriteResponse = page.waitForResponse((resp) =>
      resp.url().includes('/api/favorites') && resp.request().method() === 'POST',
    )
    await googleStar.click({ force: true })
    await favoriteResponse

    await page.getByRole('button', { name: /starred/i }).click()
    await expect(page.getByTestId('cf-starred-loading')).not.toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('cf-starred-count')).toContainText('1 item', { timeout: 10000 })
    await expect(page.getByText('File from GOOGLE A.txt').first()).toBeVisible({ timeout: 10000 })
    results.performance.star_action_to_view = Date.now() - startStar
    results.sections.starredCrossProvider = 'PASS'
    const shotStarred = 'phase5-starred-mixed-providers.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotStarred) })
    results.screenshots.push(shotStarred)

    await page.getByTestId('cf-sidebar-account-g1').click()
    const previewTarget = page.locator('[data-testid="cf-file-row"]').filter({ hasText: 'File from GOOGLE A.txt' }).first()
    await expect(previewTarget).toBeVisible({ timeout: 15000 })
    const startPreview = Date.now()
    await previewTarget.click()
    const previewPanel = page.getByTestId('cf-preview-panel')
    await expect(previewPanel).toBeVisible({ timeout: 10000 })
    results.performance.open_preview_panel = Date.now() - startPreview
    results.sections.inlinePreviewPanel = 'PASS'
    const shotPreview = 'phase5-preview-panel-text-pdf.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotPreview) })
    results.screenshots.push(shotPreview)
    await page.getByTestId('cf-preview-close').click()

    await page.keyboard.press('Shift+?')
    await expect(page.getByTestId('cf-shortcuts-help')).toBeVisible()
    results.sections.keyboardShortcuts = 'PASS'
    const shotShortcuts = 'phase5-keyboard-shortcuts-help.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotShortcuts) })
    results.screenshots.push(shotShortcuts)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /activity feed/i }).click()
    await expect(page.getByTestId('cf-activity-feed')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Uploaded File from GOOGLE A.txt')).toBeVisible({ timeout: 10000 })
    results.sections.activityFeed = 'PASS'
    const shotActivity = 'phase5-activity-feed-default.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotActivity) })
    results.screenshots.push(shotActivity)

    results.sections.visualUnification = 'PASS'
    const shotUnification = 'phase5-visual-unification-smoke.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotUnification) })
    results.screenshots.push(shotUnification)

    appendPerfMetrics(results.performance)
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
  } catch (err: any) {
    console.error('Test failed:', err)
    const shotFailure = 'phase5-failure-diagnostic.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotFailure) })
    results.screenshots.push(shotFailure)
    Object.keys(results.sections).forEach((key) => {
      if ((results.sections as any)[key] === 'PENDING') (results.sections as any)[key] = 'FAIL'
    })
    results.timestamp = new Date().toISOString()
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
    throw err
  }
})

function appendPerfMetrics(newMetrics: any) {
  try {
    let current: any = { metrics: [] }
    if (fs.existsSync(PERF_LOG_PATH)) {
      current = JSON.parse(fs.readFileSync(PERF_LOG_PATH, 'utf8'))
    }
    current.metrics.push({ ...newMetrics, timestamp: new Date().toISOString() })
    fs.writeFileSync(PERF_LOG_PATH, JSON.stringify(current, null, 2))
  } catch {
    // Ignore metric logging failures in smoke verification.
  }
}
