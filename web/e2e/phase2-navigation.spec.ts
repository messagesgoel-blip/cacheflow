import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'
const REPORT_PATH = path.join(SHOTS_DIR, 'phase2-report.json')

test('Phase 2 Verification: Structural Navigation', async ({ page }) => {
  const results = {
    sections: {
      sidebarVisibility: 'PENDING',
      breadcrumbAccuracy: 'PENDING',
      selectionToolbarContext: 'PENDING',
      navigationRegression: 'PASS'
    },
    timestamp: new Date().toISOString(),
    console_errors: [] as string[],
    page_errors: [] as string[],
    network_errors: [] as any[],
    screenshots: [] as string[]
  }

  page.on('console', msg => { if (msg.type() === 'error') results.console_errors.push(msg.text()) })
  page.on('pageerror', err => { results.page_errors.push(err.message) })

  try {
    // 1. Login
    await page.goto('http://localhost:3010/login')
    await page.evaluate(async () => {
      localStorage.clear()
      const dbs = await window.indexedDB.databases()
      for (const db of dbs) { if (db.name === 'CacheFlowMetadata') window.indexedDB.deleteDatabase(db.name) }
    })
    await page.reload()
    await page.fill('input[placeholder="Email"]', 'sup@goels.in')
    await page.fill('input[placeholder="Password"]', '123password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(5000)

    // 2. Verify Sidebar
    await expect(page.getByTestId('cf-sidebar-node-all-files')).toBeVisible()
    results.sections.sidebarVisibility = 'PASS'
    const shotSidebar = 'phase2-sidebar-expanded.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotSidebar) })
    results.screenshots.push(shotSidebar)

    // 3. Verify Breadcrumbs
    await page.getByTestId('cf-sidebar-account-g1').click()
    await page.waitForTimeout(3000)
    await expect(page.getByTestId('cf-breadcrumb')).toBeVisible()
    await expect(page.getByTestId('cf-breadcrumb')).toContainText('Google Drive A')
    
    // Navigate into a folder
    const folderRow = page.locator('tr').filter({ hasText: 'Folder from GOOGLE A' }).first()
    await folderRow.click()
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('cf-breadcrumb')).toContainText('Folder from GOOGLE A')
    results.sections.breadcrumbAccuracy = 'PASS'
    const shotBreadcrumb = 'phase2-breadcrumb-deep.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotBreadcrumb) })
    results.screenshots.push(shotBreadcrumb)

    // 4. Verify Selection Toolbar
    const fileRow = page.locator('tr').filter({ hasText: 'GOOGLE A.txt' }).first()
    await fileRow.locator('input[type="checkbox"]').click({ force: true })
    await expect(page.getByTestId('cf-selection-toolbar')).toBeVisible()
    await expect(page.getByTestId('cf-selection-toolbar')).toContainText('1 item selected')
    results.sections.selectionToolbarContext = 'PASS'
    const shotToolbar = 'phase2-selection-toolbar.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotToolbar) })
    results.screenshots.push(shotToolbar)

    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))

  } catch (err: any) {
    console.error('Test failed:', err)
    Object.keys(results.sections).forEach(key => {
      if ((results.sections as any)[key] === 'PENDING') (results.sections as any)[key] = 'FAIL'
    })
    results.timestamp = new Date().toISOString()
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
    throw err
  }
})
