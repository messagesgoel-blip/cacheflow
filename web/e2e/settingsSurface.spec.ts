import { test, expect } from '@playwright/test'

test.describe('Settings Surface', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cf_token', 'mock-token')
      localStorage.setItem('cf_email', 'sup@goels.in')
      localStorage.removeItem('cacheflow_settings')
    })
  })

  test('renders refreshed settings shell and saves local preferences', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('cf-settings-panel')).toBeVisible()
    await expect(page.getByText('Operational defaults')).toBeVisible()

    const saveButton = page.getByTestId('cf-settings-save')
    await expect(saveButton).toBeVisible()
    await saveButton.click()
    await expect(saveButton).toHaveText('Saved')
  })
})
