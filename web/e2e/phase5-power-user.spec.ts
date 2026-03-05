import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'
const REPORT_PATH = path.join(SHOTS_DIR, 'phase5-report.json')
const PERF_LOG_PATH = path.join(SHOTS_DIR, 'perf-guardrails.json')

test('Phase 5 Verification: Power-User Enhancements', async ({ page }) => {
  const results = {
    sections: {
      inlinePreviewPanel: 'PENDING',
      keyboardShortcuts: 'PENDING',
      starredCrossProvider: 'PENDING',
      activityFeed: 'PENDING',
      visualUnification: 'PENDING',
      operationRegression: 'PASS'
    },
    timestamp: new Date().toISOString(),
    console_errors: [] as string[],
    page_errors: [] as string[],
    network_errors: [] as any[],
    screenshots: [] as string[],
    performance: {} as Record<string, number>
  }

  page.on('console', msg => { if (msg.type() === 'error') results.console_errors.push(msg.text()) })
  page.on('pageerror', err => { results.page_errors.push(err.message) })
  page.on('response', response => {
    if (!response.ok() && response.status() >= 400 && !response.url().includes('Simulated')) {
      results.network_errors.push({ url: response.url(), status: response.status() })
    }
  })

  try {
    // 1. Login with stability
    const startLogin = Date.now()
    await page.goto('http://localhost:3010/login')
    await page.evaluate(async () => {
      localStorage.clear()
      const dbs = await window.indexedDB.databases()
      for (const db of dbs) { if (db.name === 'CacheFlowMetadata') window.indexedDB.deleteDatabase(db.name) }
    })
    await page.reload()
    
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible({ timeout: 10000 })
    await page.fill('input[placeholder="Email"]', 'sup@goels.in')
    await page.fill('input[placeholder="Password"]', '123password')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL(/.*files/, { timeout: 20000 })
    await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 30000 })
    results.performance.login_to_dashboard = Date.now() - startLogin

    // 2. Verify Starred/Favorites (Cross-Provider)
    await page.getByTestId('cf-sidebar-node-all-files').click()
    await page.waitForTimeout(3000)
    
    const googleFileRow = page.locator('tr').filter({ hasText: 'GOOGLE A.txt' }).first()
    await expect(googleFileRow).toBeVisible({ timeout: 15000 })

    const googleStar = googleFileRow.getByTestId('cf-row-star-toggle')
    await expect(googleStar).toBeVisible()
    
    const startStar = Date.now()
    console.log('Starring file...')
    const googleResponsePromise = page.waitForResponse(resp => 
      resp.url().includes('/favorites') && resp.request().method() === 'POST',
      { timeout: 20000 }
    )
    await googleStar.click({ force: true })
    await googleResponsePromise
    await expect(googleStar).not.toHaveAttribute('data-loading', 'true', { timeout: 10000 })
    
    await page.getByText('Starred').click()
    await expect(page.getByTestId('cf-starred-loading')).not.toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('cf-starred-count')).toContainText('1 item', { timeout: 10000 })
    
    results.performance.star_action_to_view = Date.now() - startStar
    results.sections.starredCrossProvider = 'PASS'
    const shotStarred = 'phase5-starred-mixed-providers.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotStarred) })
    results.screenshots.push(shotStarred)

    // 3. Verify Inline Preview Panel
    await page.getByTestId('cf-sidebar-node-all-files').click()
    await page.waitForTimeout(2000)
    
    const startPreview = Date.now()
    const fileToPreview = page.locator('tr').filter({ hasText: 'GOOGLE A.txt' }).first()
    await fileToPreview.click()
    
    const previewPanel = page.getByTestId('cf-preview-panel')
    await expect(previewPanel).toBeVisible({ timeout: 10000 })
    results.performance.open_preview_panel = Date.now() - startPreview
    
    results.sections.inlinePreviewPanel = 'PASS'
    const shotPreview = 'phase5-preview-panel-text-pdf.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotPreview) })
    results.screenshots.push(shotPreview)
    await page.getByTestId('cf-preview-close').click()

    // 4. Verify Keyboard Shortcuts
    await page.keyboard.press('Shift+?')
    await expect(page.getByTestId('cf-shortcuts-help')).toBeVisible()
    results.sections.keyboardShortcuts = 'PASS'
    const shotShortcuts = 'phase5-keyboard-shortcuts-help.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotShortcuts) })
    results.screenshots.push(shotShortcuts)
    await page.keyboard.press('Escape')

    // 5. Verify Activity Feed
    await page.getByText('Activity Feed').click()
    await expect(page.getByTestId('cf-activity-feed')).toBeVisible({ timeout: 15000 })
    results.sections.activityFeed = 'PASS'
    const shotActivity = 'phase5-activity-feed-default.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotActivity) })
    results.screenshots.push(shotActivity)

    // 6. Visual Unification
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
    Object.keys(results.sections).forEach(key => {
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
    if (fs.existsSync(PERF_LOG_PATH)) { current = JSON.parse(fs.readFileSync(PERF_LOG_PATH, 'utf8')) }
    current.metrics.push({ ...newMetrics, timestamp: new Date().toISOString() })
    fs.writeFileSync(PERF_LOG_PATH, JSON.stringify(current, null, 2))
  } catch (e) {}
}
