import { expect, test } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test('activity feed renders compact timeline cards with real shell navigation', async ({ page, request }) => {
  const connections: MockConnection[] = [
    {
      id: 'remote-g1',
      remoteId: 'remote-g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'google-active@example.com',
      accountLabel: 'Google Drive Active',
    },
  ]

  const activity = [
    {
      id: 'activity-upload',
      action: 'upload',
      resource: 'file',
      resource_id: 'file-1',
      created_at: new Date('2026-03-08T05:00:00.000Z').toISOString(),
      metadata: {
        fileName: 'Quarterly Plan.md',
        providerId: 'google',
        path: '/Quarterly Plan.md',
        size_bytes: 2048,
      },
    },
    {
      id: 'activity-delete',
      action: 'delete',
      resource: 'file',
      resource_id: 'file-2',
      created_at: new Date('2026-03-08T04:00:00.000Z').toISOString(),
      metadata: {
        fileName: 'Draft Notes.txt',
        providerId: 'google',
        path: '/Draft Notes.txt',
      },
    },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async () => ({ json: {} }), { activity })
  await gotoFilesAndWait(page)

  await page.getByRole('button', { name: /activity feed/i }).click()
  await expect(page.getByTestId('cf-activity-feed')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('cf-activity-item-activity-upload')).toContainText('Uploaded Quarterly Plan.md')
  await expect(page.getByTestId('cf-activity-item-activity-upload')).toContainText('/Quarterly Plan.md')
  await expect(page.getByTestId('cf-activity-item-activity-upload')).toContainText('Google Drive')
  await expect(page.getByTestId('cf-activity-item-activity-upload')).toContainText('2 KB')

  await page.getByTestId('cf-activity-filter-action').selectOption('delete')
  await expect(page.getByTestId('cf-activity-filter-action')).toHaveValue('delete')

  await page.getByTestId('cf-activity-filter-provider').selectOption('google')
  await expect(page.getByTestId('cf-activity-filter-provider')).toHaveValue('google')
})
