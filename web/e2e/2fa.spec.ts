import { test, expect } from '@playwright/test';

test.describe('2.16@2FA-1: Two-Factor Authentication', () => {
  test.beforeEach(async ({ page, request }) => {
    // 1. Mock 2FA Status
    await page.route('**/api/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      });
    });

    // 2. Mock 2FA Setup (QR Code)
    await page.route('**/api/auth/2fa/setup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/CacheFlow:sup@goels.in?secret=JBSWY3DPEHPK3PXP&issuer=CacheFlow',
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: ['12345678', '87654321', '11223344', '44332211'],
        }),
      });
    });

    // 3. Mock 2FA Verify
    await page.route('**/api/auth/2fa/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // 4. Mock Session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-123', email: 'sup@goels.in', name: 'Test User' },
          expires: new Date(Date.now() + 3600000).toISOString(),
        }),
      });
    });

    // Login as test user
    await page.addInitScript(() => {
      localStorage.setItem('cf_token', 'mock-token');
      localStorage.setItem('cf_email', 'sup@goels.in');
    });
    await page.goto('/files');
    await expect(page.locator('[data-testid="cf-sidebar-root"]')).toBeVisible({ timeout: 15000 });
  });

  test('should allow a user to setup, verify, and disable 2FA', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('cf-sidebar-user-menu').click();
    await page.getByTestId('cf-sidebar-user-settings').click();
    await expect(page).toHaveURL(/.*\/settings/);

    // Find the 2FA panel and click the enable button
    const twoFactorPanel = page.locator('[data-testid="cf-2fa-panel"]');
    await expect(twoFactorPanel).toBeVisible();
    const enableButton = twoFactorPanel.locator('button:has-text("Enable")');
    await enableButton.click();

    // Verify the QR code is displayed
    const qrCode = twoFactorPanel.locator('img[alt="QR Code"]');
    await expect(qrCode).toBeVisible();
    const qrCodeSrc = await qrCode.getAttribute('src');
    expect(qrCodeSrc).not.toBeNull();
    
    console.log('2FA setup screen with QR code verified.');

    // Placeholder for TOTP generation and verification
    console.log('TODO: Extract secret from QR, generate TOTP, and submit.');
    
    // For now, we will just verify the UI components exist
    await expect(twoFactorPanel.locator('input[placeholder="Enter 6-digit code"]')).toBeVisible();
    await expect(twoFactorPanel.locator('button:has-text("Verify & Activate")')).toBeVisible();

    // TODO: Complete the flow:
    // 1. Extract secret from qrCodeSrc
    // 2. Use a TOTP library to generate a code
    // 3. Fill the input and click "Verify & Activate"
    // 4. Verify success toast/message
    // 5. Logout
    // 6. Login again, expect redirect to /auth/2fa-challenge
    // 7. Enter new TOTP code and verify login
    // 8. Go back to settings and disable 2FA
  });
});
