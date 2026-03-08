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

test('Multi-account isolation: separate files and cache per account', async ({ page, request }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const connections: MockConnection[] = [
    {
      id: 'g1',
      remoteId: 'g1',
      provider: 'google',
      accountKey: 'key-a',
      accountEmail: 'a@example.com',
      accountLabel: 'Account A',
    },
    {
      id: 'g2',
      remoteId: 'g2',
      provider: 'google',
      accountKey: 'key-b',
      accountEmail: 'b@example.com',
      accountLabel: 'Account B',
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

    if (url.includes('drive/v3/files?')) {
      if (remoteId === 'g1') {
        return {
          json: {
            files: [
              { id: 'folder-a', name: 'Folder A', mimeType: 'application/vnd.google-apps.folder', modifiedTime: new Date().toISOString(), createdTime: new Date().toISOString() },
              { id: 'file-a', name: 'File from A.txt', mimeType: 'text/plain', size: '100', modifiedTime: new Date().toISOString(), createdTime: new Date().toISOString() },
            ],
            nextPageToken: null,
          },
        }
      }

      if (url.includes(encodeURIComponent("'folder-b' in parents"))) {
        return {
          json: {
            files: [
              { id: 'child-b', name: 'Child of B.txt', mimeType: 'text/plain', size: '50', modifiedTime: new Date().toISOString(), createdTime: new Date().toISOString() },
            ],
            nextPageToken: null,
          },
        }
      }

      return {
        json: {
          files: [
            { id: 'folder-b', name: 'Folder B', mimeType: 'application/vnd.google-apps.folder', modifiedTime: new Date().toISOString(), createdTime: new Date().toISOString() },
            { id: 'file-b', name: 'File from B.txt', mimeType: 'text/plain', size: '200', modifiedTime: new Date().toISOString(), createdTime: new Date().toISOString() },
          ],
          nextPageToken: null,
        },
      }
    }

    return { json: {} }
  })

  await gotoFilesAndWait(page)
  await page.getByTestId('cf-sidebar-node-all-files').click()
  await expect(page.getByText('File from A.txt').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('File from B.txt').first()).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: shotPath(id, 'multi_account_all_view'), fullPage: true })

  await page.getByTestId('cf-sidebar-account-key-b').click()
  await expect(page.getByText('File from B.txt').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('File from A.txt').first()).not.toBeVisible()

  const folderB = page.locator('[data-testid="cf-file-row"]').filter({ hasText: 'Folder B' }).first()
  await folderB.click()
  await expect(page.getByText('Child of B.txt').first()).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: shotPath(id, 'account_b_navigation'), fullPage: true })

  await page.getByTestId('cf-sidebar-account-key-a').click()
  await expect(page.getByText('File from A.txt').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Child of B.txt').first()).not.toBeVisible()
  await page.screenshot({ path: shotPath(id, 'account_a_switch'), fullPage: true })

  await page.getByTestId('cf-sidebar-node-all-files').click()
  await expect(page.getByText('File from A.txt').first()).toBeVisible()
  await expect(page.getByText('File from B.txt').first()).toBeVisible()
})

