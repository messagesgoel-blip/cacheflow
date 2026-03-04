import { test, expect } from '@playwright/test';

/**
 * Token Expiry and Auto-Refresh E2E Tests (AUTH-1, AUTH-2)
 * 
 * Verifies that the authInterceptor correctly handles 401 Unauthorized errors
 * by attempting to refresh the session and retrying the failed requests.
 */

test.describe('Token Expiry and Auto-Refresh', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and storage to ensure a clean state
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Mock a logged-in state by setting an accessToken cookie
    await page.context().addCookies([{
      name: 'accessToken',
      value: 'expired-token',
      domain: 'localhost',
      path: '/',
    }]);

    // Go to the dashboard/files page
    await page.goto('/files');
  });

  test('should successfully refresh token and retry request on 401', async ({ page }) => {
    let connectionsRequestCount = 0;
    let refreshRequestCount = 0;

    // Intercept /api/connections
    await page.route('**/api/connections', async (route) => {
      connectionsRequestCount++;
      if (connectionsRequestCount === 1) {
        // Return 401 on the first attempt
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Unauthorized' }),
        });
      } else {
        // Return success on the second attempt
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              { id: '1', provider: 'gdrive', accountName: 'Test Account', status: 'connected' }
            ]
          }),
        });
      }
    });

    // Intercept /api/auth/refresh
    await page.route('**/api/auth/refresh', async (route) => {
      refreshRequestCount++;
      // Return new access token and set new refreshToken cookie
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accessToken: 'new-valid-token',
          expiresAt: Date.now() + 15 * 60 * 1000
        }),
        headers: {
          'Set-Cookie': 'refreshToken=new-refresh-token; HttpOnly; Path=/api/auth; Max-Age=604800'
        }
      });
    });

    // Trigger an action that calls /api/connections
    // In this case, the page load should have already triggered it.
    // We check if the data eventually appears.
    await expect(page.locator('text=Test Account')).toBeVisible({ timeout: 10000 });

    // Verify expectations
    expect(connectionsRequestCount).toBe(2);
    expect(refreshRequestCount).toBe(1);
  });

  test('should redirect to login when refresh fails with 401', async ({ page }) => {
    // Intercept /api/connections to always return 401
    await page.route('**/api/connections', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      });
    });

    // Intercept /api/auth/refresh to return 401 (failed refresh)
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid refresh token' }),
      });
    });

    // Trigger an action that calls /api/connections
    // The page load should trigger it, then refresh fails, then redirect.
    await expect(page).toHaveURL(/.*login.*reason=session_expired/);
  });

  test('should serialize concurrent 401s and perform only one refresh', async ({ page }) => {
    let refreshRequestCount = 0;
    let connectionsRequestCount = 0;
    let remotesRequestCount = 0;

    // Intercept /api/connections
    await page.route('**/api/connections', async (route) => {
      connectionsRequestCount++;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      });
    });

    // Intercept /api/remotes
    await page.route('**/api/remotes', async (route) => {
      remotesRequestCount++;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      });
    });

    // Intercept /api/auth/refresh with a slight delay to ensure concurrency
    await page.route('**/api/auth/refresh', async (route) => {
      refreshRequestCount++;
      await page.waitForTimeout(500); // Simulate network delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accessToken: 'new-valid-token',
          expiresAt: Date.now() + 15 * 60 * 1000
        }),
      });
    });

    // Trigger multiple API calls simultaneously
    await page.evaluate(() => {
      // These will be intercepted and both return 401
      fetch('/api/connections');
      fetch('/api/remotes');
    });

    // Wait for a bit to let the calls happen
    await page.waitForTimeout(1000);

    // Verify only one refresh was attempted
    expect(refreshRequestCount).toBe(1);
  });
});
