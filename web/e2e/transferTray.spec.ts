import { test, expect } from '@playwright/test';

/**
 * Task 3.4: Tray E2E — entry survives navigation, retry works on failure
 * Gate: TRANSFER-1
 */

test.describe('Transfer Tray / Queue Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and providers
    await page.addInitScript(() => {
      localStorage.setItem('cf_token', 'test-token');
      localStorage.setItem('cf_email', 'test@example.com');

      localStorage.setItem('cacheflow_tokens_google', JSON.stringify([{
        provider: 'google', accessToken: 'g-access', refreshToken: 'g-refresh',
        expiresAt: Date.now() + 86400000, accountEmail: 'g1@example.com',
        displayName: 'Google Drive', accountId: 'g1', accountKey: 'g1', disabled: false,
        remoteId: 'g1-remote'
      }]));
      
      localStorage.setItem('cacheflow_tokens_dropbox', JSON.stringify([{
        provider: 'dropbox', accessToken: 'd-access', refreshToken: 'd-refresh',
        expiresAt: Date.now() + 86400000, accountEmail: 'd1@example.com',
        displayName: 'Dropbox', accountId: 'd1', accountKey: 'd1', disabled: false,
        remoteId: 'd1-remote'
      }]));
    });

    // Mock API responses for connections and files
    await page.route('**/api/connections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'g1-remote', provider: 'google', accountName: 'Google Drive', accountEmail: 'g1@example.com', status: 'connected', accountKey: 'g1' },
            { id: 'd1-remote', provider: 'dropbox', accountName: 'Dropbox', accountEmail: 'd1@example.com', status: 'connected', accountKey: 'd1' }
          ]
        })
      });
    });

    await page.route('**/api/remotes/*/files*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'file-1', name: 'Test File.txt', size: 1024, modifiedAt: new Date().toISOString(), isFolder: false, provider: 'google' },
            { id: 'folder-1', name: 'Dest Folder', size: 0, modifiedAt: new Date().toISOString(), isFolder: true, provider: 'dropbox' }
          ]
        })
      });
    });

    // Mock proxy calls for download/upload
    await page.route('**/api/proxy', async (route) => {
      const body = route.request().postDataJSON?.() || {};
      const url = body.url || '';
      
      if (url.includes('google') && url.includes('files/file-1')) {
        // Download
        await route.fulfill({ status: 200, body: 'file content' });
      } else if (url.includes('dropbox') && url.includes('upload')) {
        // Upload
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'new-file-id', name: 'Test File.txt' }) });
      } else {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto('/files');
    await expect(page.locator('[data-testid="cf-sidebar-root"]')).toBeVisible({ timeout: 15000 });
  });

  test('Transfer survives navigation', async ({ page }) => {
    // 1. Select a file and trigger Copy
    await page.getByText('Test File.txt').first().click();
    // Assuming we click the checkbox or use the row click if task 2.3 is active
    const row = page.locator('tr', { hasText: 'Test File.txt' });
    await row.locator('input[type="checkbox"]').click();
    
    await page.getByRole('button', { name: /copy/i }).first().click();
    
    // 2. Complete the transfer modal
    await expect(page.getByText('Copy file')).toBeVisible();
    await page.selectOption('select[aria-label="Target provider"]', 'dropbox');
    // Wait for folder list to update (mocked)
    await page.getByRole('button', { name: /Dest Folder/i }).click();
    await page.getByRole('button', { name: /copy here/i }).click();

    // 3. Verify transfer tray appears
    const tray = page.getByTestId('cf-transfer-queue-panel');
    await expect(tray).toBeVisible();
    await expect(tray).toContainText('Test File.txt');

    // 4. Navigate away
    await page.getByTestId('cf-sidebar-user-menu').click();
    await page.getByTestId('cf-sidebar-user-settings').click();
    await expect(page).toHaveURL(/.*\/settings/);

    // 5. Verify tray is STILL visible and job is there
    await expect(page.getByTestId('cf-transfer-queue-panel')).toBeVisible();
    await expect(page.getByTestId('cf-transfer-queue-panel')).toContainText('Test File.txt');
  });

  test('Retry works on failure', async ({ page }) => {
    // 1. Force a failure on upload
    await page.route('**/api/proxy', async (route) => {
      const body = route.request().postDataJSON?.() || {};
      if (body.url?.includes('dropbox') && body.url?.includes('upload')) {
        await route.fulfill({ status: 500, body: 'Upload failed' });
      } else {
        await route.continue();
      }
    }, { times: 1 });

    // 2. Trigger transfer
    await page.locator('tr', { hasText: 'Test File.txt' }).locator('input[type="checkbox"]').click();
    await page.getByRole('button', { name: /copy/i }).first().click();
    await page.selectOption('select[aria-label="Target provider"]', 'dropbox');
    await page.getByRole('button', { name: /Dest Folder/i }).click();
    await page.getByRole('button', { name: /copy here/i }).click();

    // 3. Verify failure state in tray
    const tray = page.getByTestId('cf-transfer-queue-panel');
    await expect(tray).toContainText(/failed/i, { timeout: 10000 });
    
    const retryBtn = tray.locator('button', { hasText: /retry/i });
    await expect(retryBtn).toBeVisible();

    // 4. Re-mock success for retry
    await page.route('**/api/proxy', async (route) => {
      const body = route.request().postDataJSON?.() || {};
      if (body.url?.includes('dropbox') && body.url?.includes('upload')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'new-id' }) });
      } else {
        await route.continue();
      }
    });

    // 5. Click retry
    await retryBtn.click();

    // 6. Verify success
    await expect(tray).toContainText(/completed/i, { timeout: 15000 });
  });
});
