import { test, expect } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('prod diagnosis: duplicate folders + empty folder from account mismatch', async ({ page, request }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const connections: MockConnection[] = [
    {
      id: 'g1',
      remoteId: 'g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'g1@example.com',
      accountLabel: 'Google A',
    },
    {
      id: 'g2',
      remoteId: 'g2',
      provider: 'google',
      accountKey: 'g2',
      accountEmail: 'g2@example.com',
      accountLabel: 'Google B',
    },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async ({ remoteId, url }) => {
    if (url.includes('about?fields=storageQuota')) {
      return {
        json: {
          storageQuota: {
            usage: remoteId === 'g1' ? '1024' : '2048',
            limit: '10485760',
          },
        },
      }
    }

    if (url.includes(encodeURIComponent("'g2-docs' in parents"))) {
      return {
        json: {
          files: [
            {
              id: 'g2-f1',
              name: 'g2-budget.xlsx',
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              size: '1500',
              modifiedTime: new Date().toISOString(),
              createdTime: new Date().toISOString(),
            },
          ],
          nextPageToken: null,
        },
      }
    }

    if (url.includes('drive/v3/files?')) {
      return {
        json: {
          files: [
            {
              id: `${remoteId}-docs`,
              name: 'Documents',
              mimeType: 'application/vnd.google-apps.folder',
              modifiedTime: new Date().toISOString(),
              createdTime: new Date().toISOString(),
            },
          ],
          nextPageToken: null,
        },
      }
    }

    return { json: {} }
  })

  await gotoFilesAndWait(page)
  await page.getByTestId('cf-sidebar-node-all-files').click()
  const documentsRows = page.locator('[data-testid="cf-file-row"][data-file-name="Documents"]')
  await expect(documentsRows.first()).toBeVisible({ timeout: 20000 })

  const docsCount = await documentsRows.count()
  await page.screenshot({ path: shotPath(id, 'root_duplicate_documents_rows'), fullPage: true })

  const g2DocsRow = page.locator('[data-testid="cf-file-row"][data-account-key="g2"]').filter({ hasText: 'Documents' }).first()
  await expect(g2DocsRow).toBeVisible()
  await g2DocsRow.click()

  await expect(page.getByTestId('cf-sidebar-account-g2')).toHaveClass(/bg-blue-50/)
  await expect(page.getByText('g2-budget.xlsx').first()).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: shotPath(id, 'after_click_g2_documents_row'), fullPage: true })

  expect(docsCount).toBeGreaterThan(1)
})
