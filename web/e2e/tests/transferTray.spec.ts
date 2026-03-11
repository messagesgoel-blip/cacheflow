import { test, expect } from '@playwright/test'

/**
 * Transfer Tray E2E Tests
 * 
 * Verifies that:
 * 1. Transfer entry survives navigation (Layout persistence).
 * 2. Retry works on failure (Background job retry).
 * 
 * Task: 3.4
 * Gate: TRANSFER-1
 * Contracts: 3.1, 3.2, 3.10
 */

test.describe('Transfer Tray', () => {
  const TEST_JOB_ID = 'transfer-user123-1741123456789';

  test.beforeEach(async ({ page, context }) => {
    // 1. Pre-set auth cookie
    await context.addCookies([{
      name: 'accessToken',
      value: 'test-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    }]);

    // 2. Mock Connections API
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
              status: 'connected',
              remoteId: 'remote-g1'
            }
          ]
        })
      })
    })

    // 3. Mock Session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
          expires: new Date(Date.now() + 3600000).toISOString(),
        }),
      });
    });

    // 4. Mock Transfers API (Default empty)
    await page.route('**/api/transfers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, transfers: [] })
      })
    })

    // 5. Go to files page
    await page.goto('/files')
  })

  test('transfer entry survives navigation', async ({ page }) => {
    // 1. Mock transfers list to return active transfer
    await page.route('**/api/transfers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transfers: [{
            jobId: TEST_JOB_ID,
            fileName: 'budget-2026.pdf',
            fileSize: 1048576,
            progress: 45,
            status: 'active',
            operation: 'copy',
            sourceProvider: 'google',
            destProvider: 'google'
          }]
        })
      })
    })

    // 2. Mock SSE stream
    await page.route(`**/api/transfers/${TEST_JOB_ID}/progress`, async (route) => {
      const resp = [
        'event: connected\n',
        `data: ${JSON.stringify({ jobId: TEST_JOB_ID, userId: 'user123' })}\n\n`,
        'event: progress\n',
        `data: ${JSON.stringify({ 
          jobId: TEST_JOB_ID, 
          progress: 45, 
          status: 'active', 
          data: { 
            fileName: 'budget-2026.pdf',
            fileSize: 1048576,
            sourceProvider: 'google',
            destProvider: 'google'
          } 
        })}\n\n`
      ].join('')

      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: resp })
    })

    // 3. Trigger context fetch via reload
    await page.reload()
    
    // 4. Verify Tray is visible
    const trayBadge = page.getByRole('button', { name: /active transfer/i })
    await expect(trayBadge).toBeVisible({ timeout: 15000 })
    await trayBadge.click({ force: true })

    const tray = page.getByTestId('cf-transfer-tray')
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('budget-2026.pdf')
    await expect(tray).toContainText('45%')

    // 5. Navigate to Cloud Drives
    const dismissSessionModal = page.getByRole('button', { name: /^Dismiss$/i })
    if (await dismissSessionModal.isVisible()) {
      await dismissSessionModal.click({ force: true })
    }
    await page.route('**/api/remotes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, remotes: [] })
      })
    })
    await page.goto('/remotes')
    await expect(page).toHaveURL(/\/(remotes|connections)/, { timeout: 10000 })

    // 6. Verify tray still survives
    await expect(trayBadge).toBeVisible({ timeout: 10000 })
    if (await trayBadge.isVisible()) {
      await trayBadge.click({ force: true })
    }
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('budget-2026.pdf')
  })

  test('retry works on failure', async ({ page }) => {
    // 1. Mock transfers list to return failed transfer
    await page.route('**/api/transfers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transfers: [{
            jobId: TEST_JOB_ID,
            fileName: 'budget-2026.pdf',
            fileSize: 1048576,
            progress: 10,
            status: 'failed',
            error: 'Quota exceeded',
            operation: 'copy',
            sourceProvider: 'google',
            destProvider: 'google'
          }]
        })
      })
    })

    // 2. Mock failed progress SSE
    await page.route(`**/api/transfers/${TEST_JOB_ID}/progress`, async (route) => {
      const resp = [
        'event: connected\n',
        `data: ${JSON.stringify({ jobId: TEST_JOB_ID, userId: 'user123' })}\n\n`,
        'event: progress\n',
        `data: ${JSON.stringify({ 
          jobId: TEST_JOB_ID, 
          progress: 10, 
          status: 'failed', 
          error: 'Quota exceeded',
          data: { 
            fileName: 'budget-2026.pdf',
            fileSize: 1048576,
            sourceProvider: 'google',
            destProvider: 'google'
          }
        })}\n\n`
      ].join('')

      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: resp })
    })

    // 3. Trigger context fetch via reload
    await page.reload()

    // 4. Verify failed state in tray
    const tray = page.getByTestId('cf-transfer-tray')
    const showTransfersBtn = page.getByRole('button', { name: 'Show transfers' })
    const trayBadge = page.getByRole('button', { name: /active transfer/i })

    if (!await tray.isVisible()) {
      if (await trayBadge.isVisible()) {
        await trayBadge.click()
      } else if (await showTransfersBtn.isVisible()) {
        await showTransfersBtn.click()
      }
    }

    await expect(tray).toBeVisible({ timeout: 15000 })
    await expect(tray).toContainText('Quota exceeded')
    
    // 5. Mock successful retry
    await page.route(`**/api/transfers/${TEST_JOB_ID}/retry`, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    })

    // 6. Mock progress after retry
    await page.route(`**/api/transfers/${TEST_JOB_ID}/progress`, async (route) => {
      const resp = [
        'event: progress\n',
        `data: ${JSON.stringify({ jobId: TEST_JOB_ID, progress: 100, status: 'completed' })}\n\n`
      ].join('')
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: resp })
    })

    // 7. Click Retry
    const retryBtn = tray.getByRole('button', { name: /retry/i })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    // 8. Verify success
    await expect(tray).toContainText('✅')
  })
})
