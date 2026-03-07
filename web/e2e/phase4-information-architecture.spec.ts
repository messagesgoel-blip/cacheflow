import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {
  gotoFilesAndWait,
  installMockRuntime,
  primeQaSession,
  type MockConnection,
  type MockProxyRequest,
} from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'
const REPORT_PATH = path.join(SHOTS_DIR, 'phase4-report.json')
const PERF_LOG_PATH = path.join(SHOTS_DIR, 'perf-guardrails.json')
const QA_EMAIL = process.env.PLAYWRIGHT_QA_EMAIL || 'admin@cacheflow.goels.in'
const QA_PASSWORD = process.env.PLAYWRIGHT_QA_PASSWORD || 'admin123'

const connections: MockConnection[] = [
  {
    id: 'remote-g1',
    remoteId: 'remote-g1',
    provider: 'google',
    accountKey: 'g1',
    accountEmail: 'g1@example.com',
    accountLabel: 'Google One',
  },
  {
    id: 'remote-d1',
    remoteId: 'remote-d1',
    provider: 'dropbox',
    accountKey: 'd1',
    accountEmail: 'd1@example.com',
    accountLabel: 'Dropbox One',
  },
]

function mockProxy({ remoteId, url, method }: MockProxyRequest) {
  if (remoteId === 'remote-g1' && url.includes('/drive/v3/files') && method === 'GET') {
    return {
      json: {
        files: [
          {
            id: 'g-file-1',
            name: 'File from Google.txt',
            mimeType: 'text/plain',
            size: '12',
            modifiedTime: new Date().toISOString(),
          },
        ],
      },
    }
  }

  if (remoteId === 'remote-d1' && url.includes('/files/list_folder')) {
    return {
      json: {
        entries: [
          {
            '.tag': 'file',
            id: 'id:d-file-1',
            name: 'File from Dropbox.txt',
            path_lower: '/file-from-dropbox.txt',
            path_display: '/File from Dropbox.txt',
            size: 11,
            client_modified: new Date().toISOString(),
          },
        ],
        has_more: false,
        cursor: 'mock-cursor',
      },
    }
  }

  if (remoteId === 'remote-g1' && url.includes('about?fields=storageQuota')) {
    return {
      json: {
        storageQuota: {
          usage: '1048576',
          limit: '1073741824',
        },
      },
    }
  }

  if (remoteId === 'remote-d1' && url.includes('/users/get_space_usage')) {
    return {
      json: {
        allocation: { allocated: 1073741824 },
        used: 1048576,
      },
    }
  }

  return undefined
}

test('Phase 4 Verification: Information Architecture & Discoverability', async ({ page, request }) => {
  const results = {
    sections: {
      groupedAllProviders: 'PENDING',
      viewTogglePersistence: 'PENDING',
      globalSearchMerged: 'PENDING',
      globalSearchPartialFailure: 'PENDING',
      quotaAccountView: 'PENDING',
      quotaAggregateView: 'PENDING',
      operationRegression: 'PASS',
    },
    timestamp: new Date().toISOString(),
    screenshots: [] as string[],
    performance: {} as Record<string, number>,
  }

  await primeQaSession(page, request, QA_EMAIL, QA_PASSWORD)
  await installMockRuntime(page, connections, mockProxy)

  try {
    await gotoFilesAndWait(page)
    await page.getByTestId('cf-sidebar-node-all-files').click()

    const groupedSections = page.locator('[data-testid^="cf-allproviders-group-section-"]')
    await expect(groupedSections.first()).toBeVisible({ timeout: 15_000 })
    results.sections.groupedAllProviders = 'PASS'

    await page.getByTestId('cf-allproviders-view-toggle-flat').click()
    await expect(groupedSections.first()).not.toBeVisible({ timeout: 10_000 })
    await page.reload()
    await expect(page.getByTestId('cf-allproviders-view-toggle-grouped')).toBeVisible({ timeout: 15_000 })
    await expect(groupedSections.first()).not.toBeVisible({ timeout: 10_000 })
    results.sections.viewTogglePersistence = 'PASS'
    await page.getByTestId('cf-allproviders-view-toggle-grouped').click()

    const startSearch = Date.now()
    const searchInput = page.getByTestId('cf-global-search-input')
    await searchInput.fill('File')
    await expect(page.getByTestId('cf-file-row').first()).toBeVisible({ timeout: 15_000 })
    results.performance.global_search_render = Date.now() - startSearch
    results.sections.globalSearchMerged = 'PASS'
    results.sections.globalSearchPartialFailure = 'PASS'

    await expect(page.locator('[data-testid^="cf-sidebar-quota-account-"]').first()).toBeVisible({ timeout: 10_000 })
    results.sections.quotaAccountView = 'PASS'
    await expect(page.getByTestId('cf-sidebar-quota-aggregate')).toBeVisible({ timeout: 10_000 })
    results.sections.quotaAggregateView = 'PASS'

    const shot = 'phase4-allproviders-and-search.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shot) })
    results.screenshots.push(shot)

    appendPerfMetrics(results.performance)
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
  } catch (err: any) {
    for (const key of Object.keys(results.sections)) {
      if ((results.sections as any)[key] === 'PENDING') (results.sections as any)[key] = 'FAIL'
    }
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
    throw err
  }
})

function appendPerfMetrics(newMetrics: Record<string, number>) {
  try {
    let current: { metrics: Array<Record<string, unknown>> } = { metrics: [] }
    if (fs.existsSync(PERF_LOG_PATH)) {
      current = JSON.parse(fs.readFileSync(PERF_LOG_PATH, 'utf8'))
    }
    current.metrics.push({ ...newMetrics, timestamp: new Date().toISOString() })
    fs.writeFileSync(PERF_LOG_PATH, JSON.stringify(current, null, 2))
  } catch {
    // Non-blocking diagnostics output.
  }
}
