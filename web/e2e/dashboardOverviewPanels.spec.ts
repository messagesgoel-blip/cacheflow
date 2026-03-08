import { expect, test } from '@playwright/test'
import { installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test('dashboard overview shows provider matrix and recent transfer summary', async ({ page, request }) => {
  const connections: MockConnection[] = [
    {
      id: 'remote-g1',
      remoteId: 'remote-g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'google-active@example.com',
      accountLabel: 'Google Drive Active',
    },
    {
      id: 'remote-v1',
      remoteId: 'remote-v1',
      provider: 'vps',
      accountKey: 'v1',
      accountEmail: 'vps@example.com',
      accountLabel: 'OCI VPS',
    },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async () => ({ json: {} }), {
    activity: [
      {
        id: 'activity-upload',
        action: 'upload',
        resource: 'file',
        resource_id: 'file-1',
        created_at: new Date('2026-03-08T05:30:00.000Z').toISOString(),
        metadata: {
          fileName: 'Quarterly Plan.md',
          providerId: 'google',
          path: '/Quarterly Plan.md',
          size_bytes: 2048,
        },
      },
    ],
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      'cacheflow_tokens_google',
      JSON.stringify([
        {
          provider: 'google',
          accessToken: '',
          refreshToken: '',
          expiresAt: Date.now() + 86400000,
          accountEmail: 'google-active@example.com',
          displayName: 'Google Drive Active',
          accountId: 'g1',
          accountKey: 'g1',
          disabled: false,
          remoteId: 'remote-g1',
          quota: { used: 5 * 1024 * 1024 * 1024, total: 15 * 1024 * 1024 * 1024 },
        },
      ]),
    )

    localStorage.setItem(
      'cacheflow_tokens_vps',
      JSON.stringify([
        {
          provider: 'vps',
          accessToken: '',
          refreshToken: '',
          expiresAt: Date.now() + 86400000,
          accountEmail: 'vps@example.com',
          displayName: 'OCI VPS',
          accountId: 'v1',
          accountKey: 'v1',
          disabled: false,
          remoteId: 'remote-v1',
        },
      ]),
    )
  })

  await page.route('**/api/transfers?limit=50', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        transfers: [
          {
            jobId: 'transfer-1',
            fileName: 'Quarterly Backup.tar.gz',
            fileSize: 2147483648,
            progress: 64,
            status: 'active',
            operation: 'copy',
            sourceProvider: 'google',
            destProvider: 'vps',
          },
          {
            jobId: 'transfer-2',
            fileName: 'Archive Snapshot.zip',
            fileSize: 524288000,
            progress: 100,
            status: 'completed',
            operation: 'copy',
            sourceProvider: 'google',
            destProvider: 'vps',
          },
        ],
      }),
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByText('Current provider footprint')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Hydrated account handles')).toBeVisible()
  await expect(page.getByTestId('cf-dashboard-recent-transfers')).toBeVisible()
  await expect(page.getByTestId('cf-dashboard-transfer-transfer-1')).toContainText('Quarterly Backup.tar.gz')
  await expect(page.getByTestId('cf-dashboard-transfer-transfer-1')).toContainText('64%')
  await expect(page.getByTestId('cf-dashboard-recent-activity')).toBeVisible()
  await expect(page.getByTestId('cf-dashboard-activity-activity-upload')).toContainText('Quarterly Plan.md')

  await page.getByTestId('cf-dashboard-activity-link').click()
  await expect(page).toHaveURL(/\/files\?view=activity/)
  await expect(page.getByTestId('cf-activity-feed')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Activity Feed' })).toBeVisible()
  await expect(page.getByTestId('cf-activity-filter-provider')).toBeVisible()
})
