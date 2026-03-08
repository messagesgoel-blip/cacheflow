import { expect, test } from '@playwright/test'
import { installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test('dashboard hero shows pooled quota and provider breakdown with current session harness', async ({ page, request }) => {
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
      id: 'remote-b1',
      remoteId: 'remote-b1',
      provider: 'box',
      accountKey: 'b1',
      accountEmail: 'box-degraded@example.com',
      accountLabel: 'Box Degraded',
    },
    {
      id: 'remote-d1',
      remoteId: 'remote-d1',
      provider: 'dropbox',
      accountKey: 'd1',
      accountEmail: 'dropbox-live@example.com',
      accountLabel: 'Dropbox Live',
    },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async () => ({ json: {} }))
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
      'cacheflow_tokens_box',
      JSON.stringify([
        {
          provider: 'box',
          accessToken: '',
          refreshToken: '',
          expiresAt: Date.now() + 86400000,
          accountEmail: 'box-degraded@example.com',
          displayName: 'Box Degraded',
          accountId: 'b1',
          accountKey: 'b1',
          disabled: false,
          remoteId: 'remote-b1',
          quota: { used: 2 * 1024 * 1024 * 1024, total: 10 * 1024 * 1024 * 1024 },
        },
      ]),
    )

    localStorage.setItem(
      'cacheflow_tokens_dropbox',
      JSON.stringify([
        {
          provider: 'dropbox',
          accessToken: '',
          refreshToken: '',
          expiresAt: Date.now() + 86400000,
          accountEmail: 'dropbox-live@example.com',
          displayName: 'Dropbox Live',
          accountId: 'd1',
          accountKey: 'd1',
          disabled: false,
          remoteId: 'remote-d1',
          quota: { used: 1 * 1024 * 1024 * 1024, total: 2 * 1024 * 1024 * 1024 },
        },
      ]),
    )
  })

  await page.goto('/dashboard')
  await expect(page.getByText('Total Pooled Storage')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('3 providers connected')).toBeVisible()
  await expect(page.getByText('8 GB')).toBeVisible()
  await expect(page.getByText('27 GB')).toBeVisible()
  await expect(page.getByText('Provider Breakdown')).toBeVisible()
})
