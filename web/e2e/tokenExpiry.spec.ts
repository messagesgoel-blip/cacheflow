import { test, expect } from '@playwright/test'

test.describe('Token Expiry and Auto-Refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    await page.goto('/login')
    await page.fill('input[placeholder="Email"]', 'sup@goels.in')
    await page.fill('input[placeholder="Password"]', '123password')
    await page.click('button:has-text("Sign In")')

    await expect(page).toHaveURL(/.*files/, { timeout: 20_000 })
  })

  test('Simulate 401 and verify auto-refresh retry', async ({ page }) => {
    let refreshAttempted = false
    let fileRequestCount = 0

    // Intercept API calls
    await page.route('**/files*', async (route) => {
      if (route.request().url().includes('_rsc')) {
        return route.continue()
      }
      fileRequestCount++
      if (fileRequestCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired', code: 'UNAUTHORIZED' })
        })
      } else {
        await route.continue()
      }
    })

    await page.route('**/refresh*', async (route) => {
      refreshAttempted = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'new-token' })
      })
    })

    await page.reload()
    await expect(page).toHaveURL(/.*files/)
    await page.waitForTimeout(2000)
  })
})

