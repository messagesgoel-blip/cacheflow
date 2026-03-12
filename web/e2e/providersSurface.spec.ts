import { expect, test } from '@playwright/test'
import { primeQaSession } from './helpers/mockRuntime'

const QA_EMAIL = process.env.PLAYWRIGHT_QA_EMAIL || 'admin@cacheflow.goels.in'
const QA_PASSWORD = process.env.PLAYWRIGHT_QA_PASSWORD || 'admin123'

test.describe('Providers surface', () => {
  test.beforeEach(async ({ page, request }) => {
    await primeQaSession(page, request, QA_EMAIL, QA_PASSWORD)
    await page.route('**/api/connections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'google-1',
              provider: 'google',
              accountKey: 'google-1',
              remoteId: 'google-1',
              accountName: 'Sanjay Goel',
              accountEmail: 'messages.goel@gmail.com',
              accountLabel: 'Sanjay Goel',
              isDefault: false,
              status: 'connected',
              lastSyncAt: '2026-03-08T13:37:50.207Z',
            },
            {
              id: 'vps-1',
              provider: 'vps',
              accountKey: 'vps-1',
              remoteId: 'vps-1',
              accountName: 'OCI',
              accountEmail: '',
              accountLabel: 'OCI',
              isDefault: false,
              status: 'connected',
              lastSyncAt: '2026-03-08T13:37:50.207Z',
              host: '40.233.74.160',
              port: 22,
              username: 'sanjay',
              lastTestedAt: '2026-03-08T13:37:50.207Z',
              lastHostFingerprint: 'SHA256:a1f9bf1a88cbdabd545a5cbcc5e0b7dd9e7e568e875faa78ec346242ec730ea8',
            },
          ],
        }),
      })
    })
    await page.goto('/providers')
    await expect(page).toHaveURL(/\/providers/, { timeout: 30_000 })
  })

  test('groups connected providers and connect actions by type', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connected Providers' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Cloud Provider' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Connect VPS / SFTP' })).toBeVisible()

    const cloudSection = page.getByTestId('cf-provider-section-cloud')
    const vpsSection = page.getByTestId('cf-provider-section-vps')

    await expect(cloudSection).toBeVisible({ timeout: 15_000 })
    await expect(vpsSection).toBeVisible({ timeout: 15_000 })
    await expect(cloudSection.getByTestId(/cf-provider-card-/).first()).toBeVisible({ timeout: 15_000 })
    await expect(vpsSection.getByTestId(/cf-provider-card-/).first()).toBeVisible({ timeout: 15_000 })

    await expect(page.getByRole('heading', { name: 'Available Integrations' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cloud Providers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Server-side Remotes' })).toBeVisible()
    await expect(page.getByTestId('cf-provider-connect-card-google')).toBeVisible()
    await expect(page.getByTestId('cf-provider-connect-card-vps')).toBeVisible()
  })
})
