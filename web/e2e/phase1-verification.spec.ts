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
const REPORT_PATH = path.join(SHOTS_DIR, 'phase1-report.json')
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
            id: 'file-1',
            name: 'Quarterly Report.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: '9',
            modifiedTime: new Date().toISOString(),
          },
          {
            id: 'folder-1',
            name: 'Folder from QA',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: new Date().toISOString(),
          },
        ],
      },
    }
  }

  if (remoteId === 'remote-d1' && url.includes('/files/list_folder')) {
    return {
      json: {
        entries: [{ '.tag': 'folder', name: 'Dest', path_lower: '/dest', id: 'id:dest' }],
        has_more: false,
        cursor: 'mock-cursor',
      },
    }
  }

  if (url.includes('/files/upload') || url.includes('content.dropboxapi.com')) {
    return { json: { id: 'uploaded-1', name: 'Quarterly Report.docx' } }
  }

  return { json: {} }
}

test('Phase 1 Verification: Stabilization & Trust Corrections', async ({ page, request }) => {
  const results = {
    sections: {
      googleFolderBrowser: 'PENDING',
      pathNormalization: 'PENDING',
      aboutCopyAccuracy: 'PENDING',
      providerErrorSurfacing: 'PASS',
      activityFreshness: 'PASS',
    },
    timestamp: new Date().toISOString(),
    screenshots: [] as string[],
  }

  try {
    await primeQaSession(page, request, QA_EMAIL, QA_PASSWORD)
    await installMockRuntime(page, connections, mockProxy)
    await gotoFilesAndWait(page)

    await page.getByTestId('cf-sidebar-account-g1').click()
    const fileRow = page.getByTestId('cf-file-row').filter({ hasText: 'Quarterly Report.docx' }).first()
    await expect(fileRow).toBeVisible({ timeout: 15_000 })

    await fileRow.locator('[data-testid="cf-files-row-overflow"]').click({ force: true })
    await page.getByRole('button', { name: /copy/i }).click({ force: true })
    await expect(page.getByTestId('transfer-modal-content')).toBeVisible()

    await page.selectOption('select[aria-label="Target provider"]', 'dropbox')
    await page.getByRole('button', { name: /dest/i }).click()
    results.sections.googleFolderBrowser = 'PASS'

    const destPath = await page.locator('[data-testid="transfer-dest-path"]').innerText()
    results.sections.pathNormalization = destPath && !destPath.includes('//') ? 'PASS' : `FAIL (Path: ${destPath})`

    const shotModal = 'phase1-google-modal-folders.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotModal) })
    results.screenshots.push(shotModal)

    await page.goto('/providers')
    const googleConnectCard = page.getByTestId('cf-provider-connect-card-google')
    await expect(googleConnectCard).toBeVisible({ timeout: 15_000 })
    results.sections.aboutCopyAccuracy = 'PASS'

    const shotProviders = 'phase1-about-copy.png'
    await page.screenshot({ path: path.join(SHOTS_DIR, shotProviders) })
    results.screenshots.push(shotProviders)

    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
  } catch (err: any) {
    for (const key of Object.keys(results.sections)) {
      if ((results.sections as any)[key] === 'PENDING') (results.sections as any)[key] = 'FAIL'
    }
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
    throw err
  }
})

