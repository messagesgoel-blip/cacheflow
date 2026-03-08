import { expect, test } from '@playwright/test'
import { primeQaSession } from './helpers/mockRuntime'

const PROVIDERS = [
  { id: 'google', name: 'Google Drive' },
  { id: 'onedrive', name: 'OneDrive' },
  { id: 'dropbox', name: 'Dropbox' },
  { id: 'box', name: 'Box' },
  { id: 'pcloud', name: 'pCloud' },
  { id: 'filen', name: 'Filen' },
  { id: 'yandex', name: 'Yandex Disk' },
  { id: 'webdav', name: 'WebDAV' },
  { id: 'vps', name: 'VPS / SFTP' },
]

const QA_EMAIL = process.env.PLAYWRIGHT_QA_EMAIL || 'admin@cacheflow.goels.in'
const QA_PASSWORD = process.env.PLAYWRIGHT_QA_PASSWORD || 'admin123'

test.describe('Provider Connection Modals', () => {
  test.beforeEach(async ({ page, request }) => {
    await primeQaSession(page, request, QA_EMAIL, QA_PASSWORD)
    await page.goto('/providers')
    await expect(page).toHaveURL(/\/providers/, { timeout: 30_000 })
  })

  for (const provider of PROVIDERS) {
    test(`Verify ${provider.name} connect modal`, async ({ page }) => {
      const connectCard = page.getByTestId(`cf-provider-connect-card-${provider.id}`)
      await expect(connectCard).toBeVisible({ timeout: 20_000 })

      await connectCard.getByRole('button', { name: /connect/i }).click({ force: true })

      const escapedName = provider.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const modalHeading = page.getByRole('heading', { name: new RegExp(`Connect\\s+${escapedName}`, 'i') }).first()
      await expect(modalHeading).toBeVisible({ timeout: 10_000 })

      const modal = page.locator('div.fixed.inset-0').filter({ has: modalHeading }).first()
      const closeBtn = modal.getByRole('button', { name: /cancel|close/i }).first()
      await closeBtn.click({ force: true })
      await expect(modalHeading).not.toBeVisible({ timeout: 10_000 })
    })
  }
})

