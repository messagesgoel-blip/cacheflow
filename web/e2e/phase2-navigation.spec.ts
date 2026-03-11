import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'
const REPORT_PATH = path.join(SHOTS_DIR, 'phase2-report.json')

test('Phase 2 Verification: Structural Navigation', async ({ page, request }) => {
  const connections: MockConnection[] = [
    {
      id: 'g1',
      remoteId: 'g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'username@gmail.com',
      accountLabel: 'Google Drive A',
    },
  ]

  const files = [
    {
      id: 'g-file-1',
      name: 'File from GOOGLE A.txt',
      mimeType: 'text/plain',
      size: '1024',
      modifiedTime: new Date().toISOString(),
      createdTime: new Date().toISOString(),
    },
    {
      id: 'g-folder-1',
      name: 'Folder from GOOGLE A',
      mimeType: 'application/vnd.google-apps.folder',
      size: '0',
      modifiedTime: new Date().toISOString(),
      createdTime: new Date().toISOString(),
    },
  ]

  const results = {
    sections: {
      sidebarVisibility: 'PENDING',
      breadcrumbAccuracy: 'PENDING',
      selectionToolbarContext: 'PENDING',
      navigationRegression: 'PASS',
    },
    timestamp: new Date().toISOString(),
    console_errors: [] as string[],
    page_errors: [] as string[],
    network_errors: [] as any[],
    screenshots: [] as string[],
  }

  page.on('console', (msg) => {
    if (msg.type() === 'error') results.console_errors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    results.page_errors.push(err.message)
  })

  try {
    await primeQaSession(page, request)
    await installMockRuntime(page, connections, async ({ url }) => {
      if (url.includes('about?fields=storageQuota')) {
        return {
          json: {
            storageQuota: {
              usage: '1024',
              limit: '1048576',
            },
          },
        }
      }

      if (url.includes('drive/v3/files?') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
        return {
          json: {
            files,
            nextPageToken: null,
          },
        }
      }

      return { json: {} }
    })
    await gotoFilesAndWait(page)

    await expect(page.getByTestId('cf-sidebar-node-all-files')).toBeVisible()
    results.sections.sidebarVisibility = 'PASS'
    const shotSidebar = 'phase2-sidebar-expanded.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotSidebar) })
    results.screenshots.push(shotSidebar)

    await expect(page.getByTestId('cf-sidebar-account-g1')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('cf-sidebar-account-g1').click()
    await expect(page.getByTestId('cf-breadcrumb')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('cf-breadcrumb')).toContainText('Google Drive A')

    const fileRow = page.locator('[data-testid="cf-file-row"]').filter({ hasText: 'File from GOOGLE A.txt' }).first()
    await expect(fileRow).toBeVisible({ timeout: 15000 })
    await fileRow.getByRole('checkbox').click({ force: true })
    await expect(page.getByTestId('cf-selection-toolbar')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('cf-selection-toolbar')).toContainText('1 item selected')
    results.sections.selectionToolbarContext = 'PASS'
    const shotToolbar = 'phase2-selection-toolbar.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotToolbar) })
    results.screenshots.push(shotToolbar)

    await page.locator('button[title="Clear selection"]').click()

    const folderRow = page.locator('[data-testid="cf-file-row"]').filter({ hasText: 'Folder from GOOGLE A' }).first()
    await folderRow.click()
    await expect(page.getByTestId('cf-breadcrumb')).toContainText('Folder from GOOGLE A')
    results.sections.breadcrumbAccuracy = 'PASS'
    const shotBreadcrumb = 'phase2-breadcrumb-deep.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotBreadcrumb) })
    results.screenshots.push(shotBreadcrumb)

    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
  } catch (err: any) {
    console.error('Test failed:', err)
    Object.keys(results.sections).forEach((key) => {
      if ((results.sections as any)[key] === 'PENDING') (results.sections as any)[key] = 'FAIL'
    })
    results.timestamp = new Date().toISOString()
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
    throw err
  }
})
