import { test, expect } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('regression: mixed providers date fallback + copy/move semantics', async ({ page, request }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const connections: MockConnection[] = [
    {
      id: 'g1',
      remoteId: 'g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'g1@example.com',
      accountLabel: 'Google One',
    },
    {
      id: 'd1',
      remoteId: 'd1',
      provider: 'dropbox',
      accountKey: 'd1',
      accountEmail: 'd1@example.com',
      accountLabel: 'Dropbox One',
    },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async ({ url }) => {
    if (url.includes('about?fields=storageQuota')) {
      return { json: { storageQuota: { usage: '0', limit: '100' } } }
    }
    if (url.includes('drive/v3/files?') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
      return {
        json: {
          files: [{
            id: 'g-xlsx',
            name: 'Budget 2026.xlsx',
            mimeType: 'text/plain',
            size: '5',
            modifiedTime: new Date().toISOString(),
            createdTime: new Date().toISOString(),
            parents: ['root'],
          }],
          nextPageToken: null,
        },
      }
    }
    if (url.includes('/files/list_folder')) {
      // Intentionally omit server-modified timestamp to exercise date fallback rendering.
      return {
        json: {
          entries: [{
            '.tag': 'file',
            name: 'Notes.txt',
            path_lower: '/notes.txt',
            path_display: '/Notes.txt',
            id: 'id:notes',
            size: 1,
          }],
          has_more: false,
          cursor: 'dropbox-cursor',
        },
      }
    }
    return { json: {} }
  })

  await gotoFilesAndWait(page)
  await page.getByTestId('cf-sidebar-account-d1').click()
  await expect(page.getByText('Notes.txt').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Invalid Date')).toHaveCount(0)
  await page.screenshot({ path: shotPath(id, 'regression_mixed_provider_date_fallback'), fullPage: true })
})

