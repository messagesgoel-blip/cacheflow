import { test, expect } from '@playwright/test'

const PROVIDERS = [
  { id: 'google', name: 'Google Drive' },
  { id: 'onedrive', name: 'OneDrive' },
  { id: 'dropbox', name: 'Dropbox' },
  { id: 'box', name: 'Box' },
  { id: 'pcloud', name: 'pCloud' },
  { id: 'filen', name: 'Filen' },
  { id: 'yandex', name: 'Yandex Disk' },
  { id: 'webdav', name: 'WebDAV' },
  { id: 'vps', name: 'VPS / SFTP' }
]

test.describe('Provider Connection Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const email = `test-${Date.now()}@example.com`
    const password = 'TestPassword123!'

    // Simple register
    await page.click('text=Need an account? Register')
    await page.fill('input[placeholder="Email"]', email)
    await page.fill('input[placeholder="Password"]', password)
    await page.click('button:has-text("Register")')

    // Wait for redirect or manual goto
    await page.waitForURL(/.*files/, { timeout: 15000 }).catch(() => {})
    await page.goto('/providers')
    
    // Verify we are on the right page
    await expect(page).toHaveURL(/.*providers/)
  })

  for (const provider of PROVIDERS) {
    test(`Verify ${provider.name} connect modal`, async ({ page }) => {
      // Find the card for the provider
      const heading = page.getByRole('heading', { name: provider.name, exact: true, level: 3 })
      const card = heading.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      
      await card.getByRole('button', { name: /connect|manage/i }).click()

      // Check modal
      const escapedName = provider.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const modalHeading = page.getByRole('heading', { name: new RegExp(`Connect\\s+${escapedName}`, 'i') })
      await expect(modalHeading).toBeVisible()
      const modal = page.locator('div.fixed.inset-0').filter({ has: modalHeading })

      // Close
      const closeBtn = modal.locator('button:has-text("Cancel"), button:has-text("Close"), .absolute.top-4.right-4 button').first()
      await closeBtn.click()
      await expect(modal).not.toBeVisible()
    })
  }
})
