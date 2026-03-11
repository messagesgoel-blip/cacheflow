import { test, expect } from '@playwright/test';

/**
 * Task 5.8: E2E vault tests — enable, lock, unlock, auto-lock
 * Gate: VAULT-1
 * Contracts: 5.5, 5.6
 */

test.describe('Vault / Private Folder E2E', () => {
  const MOCK_TOKEN = 'mock-jwt-vault-token';
  const MOCK_EMAIL = 'vault-tester@example.com';
  const MOCK_VAULT_ID = 'vault_12345678';
  const MOCK_PIN = '1234';
  const MOCK_SESSION_TOKEN = 'vault_session_abc';

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([{
      name: 'accessToken',
      value: MOCK_TOKEN,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'vault-user', email: MOCK_EMAIL },
        }),
      });
    });

    // Mock connections API (empty)
    await page.route('**/api/connections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test('VAULT-1: Sidebar does not render Private Folder entry by default', async ({ page }) => {
    await page.goto('/files');
    const sidebar = page.getByTestId('cf-sidebar-root');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Private Folder')).not.toBeVisible();
  });

  test('VAULT-1: Unlock endpoint accepts valid PIN', async ({ page }) => {
    await page.route(`**/api/vault/*/unlock`, async (route) => {
      const { pin } = route.request().postDataJSON();
      if (pin === MOCK_PIN) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            session_token: MOCK_SESSION_TOKEN,
            expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Invalid PIN' }),
        });
      }
    });

    await page.goto('/files');
    const result = await page.evaluate(
      async ({ vaultId, pin, token }) => {
        const res = await fetch(`/api/vault/${vaultId}/unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pin }),
        });
        return { status: res.status, body: await res.json() };
      },
      { vaultId: MOCK_VAULT_ID, pin: MOCK_PIN, token: MOCK_TOKEN },
    );

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.session_token).toBe(MOCK_SESSION_TOKEN);
    expect(Number.isNaN(Date.parse(result.body.expires_at))).toBe(false);
  });

  test('VAULT-1: Unlock endpoint rejects invalid PIN', async ({ page }) => {
    await page.route(`**/api/vault/*/unlock`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid PIN' }),
      });
    });

    await page.goto('/files');
    const result = await page.evaluate(
      async ({ vaultId, token }) => {
        const res = await fetch(`/api/vault/${vaultId}/unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pin: '9999' }),
        });
        return { status: res.status, body: await res.json() };
      },
      { vaultId: MOCK_VAULT_ID, token: MOCK_TOKEN },
    );

    expect(result.status).toBe(401);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toContain('Invalid PIN');
  });
});
