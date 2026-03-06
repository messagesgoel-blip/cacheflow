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

test('prod diagnostic: duplicate folders with 4 drives and nested files', async ({ page, request }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const connections: MockConnection[] = [
    { id: 'g1', remoteId: 'g1', provider: 'google', accountKey: 'g1', accountEmail: 'g1@example.com', accountLabel: 'Google A' },
    { id: 'g2', remoteId: 'g2', provider: 'google', accountKey: 'g2', accountEmail: 'g2@example.com', accountLabel: 'Google B' },
    { id: 'd1', remoteId: 'd1', provider: 'dropbox', accountKey: 'd1', accountEmail: 'd1@example.com', accountLabel: 'Dropbox A' },
    { id: 'd2', remoteId: 'd2', provider: 'dropbox', accountKey: 'd2', accountEmail: 'd2@example.com', accountLabel: 'Dropbox B' },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async ({ remoteId, url, jsonBody }) => {
    if (url.includes('about?fields=storageQuota')) {
      return {
        json: {
          storageQuota: {
            usage: '1024',
            limit: '10485760',
          },
        },
      }
    }

    if (url.includes('/users/get_space_usage')) {
      return {
        json: {
          allocation: { allocated: 10485760 },
          used: 1024,
        },
      }
    }

    if (url.includes('drive/v3/files?')) {
      const folderId = remoteId.endsWith('2') ? `${remoteId}-docs` : `${remoteId}-docs`
      if (url.includes(encodeURIComponent(`'${folderId}' in parents`))) {
        return {
          json: {
            files: [
              {
                id: `${remoteId}-f1`,
                name: `${remoteId}-file.txt`,
                mimeType: 'text/plain',
                size: '100',
                modifiedTime: new Date().toISOString(),
                createdTime: new Date().toISOString(),
              },
            ],
            nextPageToken: null,
          },
        }
      }

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

    if (url.includes('/files/list_folder')) {
      const payload = (jsonBody as { path?: string }) || {}
      const folderPath = payload.path || ''
      if (folderPath === `/${remoteId}-docs`) {
        return {
          json: {
            entries: [
              {
                '.tag': 'file',
                id: `id:${remoteId}-f1`,
                name: `${remoteId}-file.txt`,
                path_lower: `/${remoteId}-docs/${remoteId}-file.txt`,
                path_display: `/${remoteId}-docs/${remoteId}-file.txt`,
                size: 100,
                client_modified: new Date().toISOString(),
                server_modified: new Date().toISOString(),
              },
            ],
            has_more: false,
            cursor: 'mock-cursor',
          },
        }
      }

      return {
        json: {
          entries: [
            {
              '.tag': 'folder',
              id: `id:${remoteId}-docs`,
              name: 'Documents',
              path_lower: `/${remoteId}-docs`,
              path_display: `/${remoteId}-docs`,
            },
          ],
          has_more: false,
          cursor: 'mock-cursor',
        },
      }
    }

    return { json: {} }
  })

  await gotoFilesAndWait(page)
  await page.getByTestId('cf-sidebar-node-all-files').click()
  const rootDocsRows = page.locator('[data-testid="cf-file-row"][data-file-name="Documents"]')
  await expect(rootDocsRows.first()).toBeVisible({ timeout: 20000 })

  const rootDocsCount = await rootDocsRows.count()
  await page.screenshot({ path: shotPath(id, 'root_duplicates'), fullPage: true })

  const probes = [
    { key: 'g2', sidebarId: 'cf-sidebar-account-g2', expectedFile: 'g2-file.txt' },
    { key: 'g1', sidebarId: 'cf-sidebar-account-g1', expectedFile: 'g1-file.txt' },
    { key: 'd2', sidebarId: 'cf-sidebar-account-d2', expectedFile: 'd2-file.txt' },
    { key: 'd1', sidebarId: 'cf-sidebar-account-d1', expectedFile: 'd1-file.txt' },
  ]

  for (const probe of probes) {
    await page.getByTestId('cf-sidebar-node-all-files').click()
    const row = page.locator(`[data-testid="cf-file-row"][data-account-key="${probe.key}"]`).filter({ hasText: 'Documents' }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.click()
    await expect(page.getByTestId(probe.sidebarId)).toHaveClass(/bg-blue-50/)
    await expect(page.getByText(probe.expectedFile).first()).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: shotPath(id, `after_click_${probe.key}_documents`), fullPage: true })
  }

  expect(rootDocsCount).toBeGreaterThan(1)
})
