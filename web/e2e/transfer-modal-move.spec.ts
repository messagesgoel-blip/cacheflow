import { expect, test } from '@playwright/test'
import {
  gotoFilesAndWait,
  installMockRuntime,
  primeQaSession,
  type MockConnection,
  type MockProxyRequest,
} from './helpers/mockRuntime'

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
            name: 'Budget 2026.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: '5',
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

  if (remoteId === 'remote-d1' && (url.includes('/files/upload') || url.includes('content.dropboxapi.com'))) {
    return {
      json: {
        id: 'id:uploaded',
        name: 'Budget 2026.xlsx',
        path_display: '/Dest/Budget 2026.xlsx',
      },
    }
  }

  if (remoteId === 'remote-g1' && method === 'DELETE' && url.includes('/drive/v3/files/')) {
    return { status: 204, body: '' }
  }

  if (url.includes('alt=media')) {
    return {
      contentType: 'application/octet-stream',
      body: 'cacheflow transfer test content',
    }
  }

  return { json: {} }
}

test('move between providers via transfer modal', async ({ page, request }) => {
  await primeQaSession(page, request, QA_EMAIL, QA_PASSWORD)
  await installMockRuntime(page, connections, mockProxy)

  await gotoFilesAndWait(page)
  await page.getByTestId('cf-sidebar-account-g1').click()

  const budgetRow = page.getByTestId('cf-file-row').filter({ hasText: 'Budget 2026.xlsx' }).first()
  await expect(budgetRow).toBeVisible({ timeout: 15_000 })

  await budgetRow.getByTestId('cf-row-checkbox').click({ force: true })
  await page.getByTestId('cf-selection-toolbar').getByRole('button', { name: 'Move' }).click({ force: true })
  await expect(page.getByText('Move file')).toBeVisible()

  await page.selectOption('select[aria-label="Target provider"]', 'dropbox')
  await page.getByRole('button', { name: /dest/i }).click()
  await page.getByRole('button', { name: /move here/i }).click()

  const queuePanel = page.getByTestId('cf-transfer-queue-panel')
  await expect(queuePanel).toBeVisible({ timeout: 10_000 })
  await expect(queuePanel).toContainText(/moving|completed/i, { timeout: 30_000 })
})
