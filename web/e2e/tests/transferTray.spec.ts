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

    // 3. Mock Remotes/Proxy API (Files list)
    await page.route('**/api/remotes/*/proxy', async (route) => {
      const body = route.request().postDataJSON()
      if (body?.url?.includes('files') || body?.url?.includes('list')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [{
              id: 'g-file-1',
              name: 'budget-2026.pdf',
              mimeType: 'application/pdf',
              size: 1048576,
              modifiedTime: new Date().toISOString(),
              provider: 'google',
              remoteId: 'remote-g1',
              accountKey: 'g1'
            }]
          })
        })
      } else {
        await route.continue()
      }
    })

    // 4. Mock Transfers API (Initial list)
    await page.route('**/api/transfers?limit=50', async (route) => {
      const transfers = [
        {
          jobId: TEST_JOB_ID,
          fileName: 'budget-2026.pdf',
          fileSize: 1048576,
          progress: 45,
          status: 'active',
          operation: 'copy',
          sourceProvider: 'google',
          destProvider: 'google'
        }
      ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, transfers })
      })
    })

    // 5. Mock Session
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

    // 6. Go to files page
    await page.goto('/files')
    
    // Inject localStorage for UI consistency
    await page.evaluate(() => {
      localStorage.setItem('cf_token', 'test-token')
      localStorage.setItem('cf_email', 'test@example.com')
    })
  })

  test('transfer entry survives navigation', async ({ page }) => {
    // 1. Mock the creation of a transfer
    await page.route('**/api/transfers', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, jobId: TEST_JOB_ID, status: 'queued' })
        })
      } else {
        await route.continue()
      }
    })

    // 2. Mock SSE stream (Contract 3.2)
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

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: resp
      })
    })

    // 3. Trigger transfer in UI
    // Note: We use page.evaluate to call the startTransfer directly if UI is using legacy tray
    // but here we'll try to trigger it via UI if possible.
    // If the UI is using TransferQueuePanel, we test that one.
    // If it's using TransferTray, we test that one.
    
    // For now, let's assume the UI should trigger the background transfer.
    await page.getByTestId('cf-sidebar-account-g1').first().click()
    const fileRow = page.locator('tr').filter({ hasText: 'budget-2026.pdf' }).first()
    await fileRow.locator('input[type="checkbox"]').check({ force: true })
    await page.getByRole('button', { name: /copy/i }).first().click()
    
    // Wait for modal and click "Copy here"
    const copyHereBtn = page.getByRole('button', { name: /copy here/i })
    await expect(copyHereBtn).toBeVisible()
    await copyHereBtn.click()

    // 4. Verify Tray is visible and has progress
    // If tray is collapsed (shows badge), click it to expand
    const trayBadge = page.getByRole('button', { name: /active transfer/i })
    if (await trayBadge.isVisible()) {
      await trayBadge.click()
    }

    // TransferTray has text "Transfers" and the file name
    const tray = page.getByTestId('cf-transfer-tray')
    await expect(tray).toBeVisible({ timeout: 10000 })
    await expect(tray).toContainText('budget-2026.pdf')
    await expect(tray).toContainText('45%')

    // 5. Navigate to Cloud Drives
    await page.getByRole('link', { name: /Cloud Drives/i }).click()
    await expect(page).toHaveURL(/\/remotes/)

    // 6. Verify tray still survives and progress is maintained
    // Tray might auto-collapse on navigation if implementation changed, so check badge or tray
    if (await trayBadge.isVisible()) {
      await trayBadge.click()
    }
    await expect(tray).toBeVisible({ timeout: 5000 })
    await expect(tray).toContainText('budget-2026.pdf')
    await expect(tray).toContainText('45%')
  })

  test('retry works on failure', async ({ page }) => {
    // 1. Mock a failed transfer via SSE
    await page.route('**/api/transfers', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ success: true, jobId: TEST_JOB_ID })
        })
      }
    })

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

    // 2. Start transfer
    await page.getByTestId('cf-sidebar-account-g1').first().click()
    const fileRow = page.locator('tr').filter({ hasText: 'budget-2026.pdf' }).first()
    await fileRow.locator('input[type="checkbox"]').check({ force: true })
    await page.getByRole('button', { name: /copy/i }).first().click()
    await page.getByRole('button', { name: /copy here/i }).click()

    // 3. Verify failed state
    const trayBadge = page.getByRole('button', { name: /active transfer/i })
    if (await trayBadge.isVisible()) {
      await trayBadge.click()
    }

    const tray = page.getByTestId('cf-transfer-tray')
    await expect(tray).toContainText('Quota exceeded')
    
    // 4. Mock successful retry API and subsequent SSE
    await page.route(`**/api/transfers/${TEST_JOB_ID}/retry`, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    })

    // Mock progress after retry
    await page.route(`**/api/transfers/${TEST_JOB_ID}/progress`, async (route) => {
      const resp = [
        'event: progress\n',
        `data: ${JSON.stringify({ jobId: TEST_JOB_ID, progress: 100, status: 'completed' })}\n\n`,
        'event: done\n',
        `data: ${JSON.stringify({ status: 'completed' })}\n\n`
      ].join('')
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: resp })
    })

    // 5. Click Retry
    const retryBtn = tray.getByRole('button', { name: /retry/i })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    // 6. Verify success
    await expect(tray).toContainText('✅')
    await expect(tray).not.toContainText('Retry')
  })
})
