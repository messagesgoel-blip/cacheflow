import { expect, test } from '@playwright/test'
import { installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test('dashboard quick actions render and navigate to real routes', async ({ page, request }) => {
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

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async () => ({ json: {} }))
  await page.goto('/dashboard')

  await expect(page.getByTestId('cf-dashboard-quick-actions')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('cf-dashboard-quick-action-files')).toContainText('Open Files')
  await expect(page.getByTestId('cf-dashboard-quick-action-providers')).toContainText('Connect Provider')

  await page.getByTestId('cf-dashboard-quick-action-providers').click()
  await expect(page).toHaveURL(/\/providers$/)
})
