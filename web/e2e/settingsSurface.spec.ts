import { test, expect } from '@playwright/test'

test.describe('Settings Surface', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([{
      name: 'accessToken',
      value: 'mock-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }])

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'qa-user', email: 'sup@goels.in' },
        }),
      })
    })

    await page.addInitScript(() => {
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
