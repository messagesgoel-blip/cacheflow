import { test, expect } from '@playwright/test'

/**
 * Task 3.4: Tray E2E — entry survives navigation, retry works on failure
 * Legacy coverage spec (non-gate)
 */

test.describe('Transfer Tray / Queue Panel', () => {
  const TEST_JOB_ID = 'transfer-user123-legacy'

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'accessToken',
        value: 'test-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'accessToken',
        value: 'test-token',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.addInitScript(() => {
      localStorage.setItem('cf_token', 'test-token')
      localStorage.setItem('cf_email', 'test@example.com')
    })

    await page.route('**/api/connections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'remote-g1',
              provider: 'google',
              accountKey: 'g1',
              accountEmail: 'g1@example.com',
              accountLabel: 'Google One',
              remoteId: 'remote-g1',
              status: 'connected',
            },
          ],
        }),
      })
    })

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
          expires: new Date(Date.now() + 3600000).toISOString(),
        }),
      })
    })
  })

  test('Transfer survives navigation', async ({ page }) => {
    await page.route('**/api/transfers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transfers: [
            {
              jobId: TEST_JOB_ID,
              fileName: 'Test File.txt',
              fileSize: 1024,
              progress: 45,
              status: 'active',
              operation: 'copy',
              sourceProvider: 'google',
              destProvider: 'dropbox',
            },
          ],
        }),
      })
    })

    await page.goto('/files')
    await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })

    const trayBadge = page.getByRole('button', { name: /active transfer/i })
    await expect(trayBadge).toBeVisible({ timeout: 15000 })
    await trayBadge.click({ force: true })

    const tray = page.getByTestId('cf-transfer-tray')
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('Test File.txt')
    await expect(tray).toContainText('45%')

    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings/)

    await expect(trayBadge).toBeVisible({ timeout: 10000 })
    await trayBadge.click({ force: true })
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('Test File.txt')
  })

  test('Retry works on failure', async ({ page }) => {
    await page.route('**/api/transfers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transfers: [
            {
              jobId: TEST_JOB_ID,
              fileName: 'Test File.txt',
              fileSize: 1024,
              progress: 10,
              status: 'failed',
              error: 'Quota exceeded',
              operation: 'copy',
              sourceProvider: 'google',
              destProvider: 'dropbox',
            },
          ],
        }),
      })
    })

    await page.route(`**/api/transfers/${TEST_JOB_ID}/retry`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    await page.goto('/files')
    await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })

    const trayBadge = page.getByRole('button', { name: /active transfer|show transfers/i })
    await expect(trayBadge).toBeVisible({ timeout: 15000 })
    await trayBadge.click({ force: true })

    const tray = page.getByTestId('cf-transfer-tray')
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('Quota exceeded')

    const retryBtn = tray.getByRole('button', { name: /retry/i })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()
  })
})

