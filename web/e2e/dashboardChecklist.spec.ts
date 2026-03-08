import { expect, test } from '@playwright/test'
import { installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test('dashboard onboarding checklist reflects real frontend milestones', async ({ page, request }) => {
  const connections: MockConnection[] = [
    {
      id: 'remote-g1',
      remoteId: 'remote-g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'g1@example.com',
      accountLabel: 'Google One',
    },
  ]

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async () => ({ json: {} }))
  await page.addInitScript(() => {
    localStorage.setItem(
      'cacheflow:onboarding-milestones',
      JSON.stringify({
        uploadCompleted: true,
        transferCompleted: true,
        dismissed: false,
      }),
    )
  })

  await page.route('**/api/auth/2fa/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: false,
        backupCodesRemaining: 0,
      }),
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByTestId('cf-dashboard-onboarding')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('3 of 4 milestones completed.')).toBeVisible()
  await expect(page.getByTestId('cf-dashboard-onboarding-step-providers')).toContainText('Complete')
  await expect(page.getByTestId('cf-dashboard-onboarding-step-upload')).toContainText('Complete')
  await expect(page.getByTestId('cf-dashboard-onboarding-step-transfer')).toContainText('Complete')
  await expect(page.getByTestId('cf-dashboard-onboarding-step-security')).toContainText('Pending')
  await expect(page.getByRole('link', { name: 'Enable 2FA' })).toHaveAttribute('href', '/settings/security')
})
