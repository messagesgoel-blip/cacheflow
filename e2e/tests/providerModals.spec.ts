import { test, expect } from '@playwright/test'

/**
 * Provider Connection Modals Test
 * Task: 1.11
 * Gate: MODAL-1
 * 
 * Verifies that all 9 provider "Connect" buttons open the correct modal
 * and that the modals can be closed.
 */

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

test.describe('Provider Hub - Connection Modals', () => {
  
  test.beforeEach(async ({ page }) => {
    // Go to login page
    await page.goto('/')
    
    // Check if we need to switch to register mode
    const registerButton = page.locator('button:has-text("Need an account? Register")')
    if (await registerButton.isVisible()) {
      await registerButton.click()
    }

    const email = `test-modals-${Date.now()}@example.com`
    const password = 'TestPassword123!'

    // Fill registration form
    await page.fill('input[placeholder="Email"]', email)
    await page.fill('input[placeholder="Password"]', password)
    await page.click('button:has-text("Register")')

    // Wait for the redirect to /files or /dashboard (home)
    await page.waitForURL(/.*(files|dashboard)/, { timeout: 20000 }).catch(() => {
      // Fallback if no redirect happens automatically
      return page.goto('/files')
    })

    // Navigate to Providers page
    await page.goto('/providers')
    await expect(page).toHaveURL(/.*providers/)
    
    // Wait for providers to load
    await expect(page.locator('h1:has-text("Cloud Storage")')).toBeVisible()
  })

  for (const provider of PROVIDERS) {
    test(`Verify ${provider.name} connect modal opens and closes`, async ({ page }) => {
      // Find the card for the provider
      // We look for a card containing the provider name as an H3
      const card = page.locator('div', { has: page.locator('h3', { hasText: provider.name, exact: true }) })
        .filter({ has: page.getByRole('button', { name: 'Connect' }) })
        .first()
      
      await expect(card).toBeVisible()
      
      // Click the Connect button
      const connectBtn = card.getByRole('button', { name: 'Connect' })
      await connectBtn.click()

      // Verify modal is visible
      const modal = page.locator('div.fixed.inset-0')
      await expect(modal).toBeVisible()
      
      // Verify modal title contains provider name
      const modalTitle = modal.locator('h3')
      await expect(modalTitle).toContainText(provider.name)

      // Specific form checks for WebDAV and VPS
      if (provider.id === 'webdav') {
        await expect(modal.locator('input[placeholder="https://dav.example.com/dav"]')).toBeVisible()
        await expect(modal.locator('input[placeholder="username"]')).toBeVisible()
        await expect(modal.locator('input[placeholder="password"]')).toBeVisible()
      } else if (provider.id === 'vps') {
        await expect(modal.locator('input[placeholder="your-server.com"]')).toBeVisible()
        await expect(modal.locator('input[placeholder="22"]')).toBeVisible()
        await expect(modal.locator('input[placeholder="username"]')).toBeVisible()
        await expect(modal.locator('input[placeholder="password or private key"]')).toBeVisible()
      } else {
        // OAuth providers should have an Authorize button
        await expect(modal.locator('button:has-text("Authorize")')).toBeVisible()
      }

      // Verify the modal has a Cancel button and click it
      const cancelBtn = modal.locator('button:has-text("Cancel")')
      await expect(cancelBtn).toBeVisible()
      await cancelBtn.click()

      // Verify modal is closed
      await expect(modal).not.toBeVisible()
    })
  }
})
