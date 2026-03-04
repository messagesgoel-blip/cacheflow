import { test, expect } from '@playwright/test';
import * as crypto from 'node:crypto';

/**
 * 2FA E2E Test
 * Task: 2.16
 * Gate: 2FA-1
 * 
 * Full cycle: Enable 2FA -> Logout -> Login with 2FA -> Disable 2FA
 */

// Helper to generate TOTP code from secret
async function generateTOTP(secret: string, timestamp: number = Date.now()): Promise<string> {
  const period = 30;
  const digits = 6;
  const timeStep = Math.floor(timestamp / 1000 / period);
  
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setBigUint64(0, BigInt(timeStep), false);
  
  const keyData = base32ToBytes(secret);
  const cryptoSubtle = crypto.webcrypto.subtle;
  
  const key = await cryptoSubtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await cryptoSubtle.sign('HMAC', key, timeBuffer);
  const hmac = new Uint8Array(signature);
  
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  
  return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
}

function base32ToBytes(base32: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

test.describe('Two-Factor Authentication Flow', () => {
  const email = 'sup@goels.in';
  const password = '123password';

  test('should enable, use, and disable 2FA', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Sign In")');
    await page.waitForURL(/.*(files|dashboard|remotes)/);

    // 2. Navigate to Security Settings
    await page.goto('/settings/security');
    await expect(page.locator('h1')).toContainText('Security Settings', { timeout: 15000 });

    // 3. Start 2FA Setup
    const setupResponsePromise = page.waitForResponse(r => r.url().includes('/api/auth/2fa/setup') && r.request().method() === 'POST');
    await page.click('button:has-text("Enable Two-Factor Authentication")');
    const setupResponse = await setupResponsePromise;
    const setupData = await setupResponse.json();
    
    expect(setupData.success).toBe(true);
    const qrCodeUrl = setupData.qrCodeUrl;
    expect(qrCodeUrl).toContain('otpauth://totp/');

    // Extract secret from otpauth URL
    const url = new URL(qrCodeUrl);
    const secret = url.searchParams.get('secret');
    expect(secret).not.toBeNull();
    console.log('Extracted 2FA secret from QR code URL');

    // 4. Generate and enter TOTP code
    const code = await generateTOTP(secret!);
    await page.fill('input[placeholder="Enter 6-digit code"]', code);
    await page.click('button:has-text("Verify & Activate")');

    // 5. Verify 2FA is enabled
    await expect(page.locator('text=Enabled')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Backup Codes')).toBeVisible();

    // 6. Logout
    // Clear localStorage manually to be sure
    await page.evaluate(() => {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_email');
    });
    await page.goto('/login');
    await page.waitForURL(/.*login/);

    // 7. Login again - should trigger 2FA challenge
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Sign In")');

    // Expect redirect to 2FA challenge page
    await page.waitForURL(/.*2fa-challenge/, { timeout: 10000 });
    await expect(page.locator('h2')).toContainText('Two-Factor Authentication');

    // 8. Enter new TOTP code
    const newCode = await generateTOTP(secret!);
    // The TOTPInput has aria-label="Two-factor authentication code"
    await page.locator('[aria-label="Two-factor authentication code"]').fill(newCode);
    await page.click('button:has-text("Verify")');

    // Should redirect to files
    await page.waitForURL(/.*files/, { timeout: 15000 });

    // 9. Disable 2FA
    await page.goto('/settings/security');
    
    // Handle the password prompt dialog
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Disable")');
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('password');
    await dialog.accept(password);
    
    // Verify 2FA is disabled
    await expect(page.locator('text=Not enabled')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Enable Two-Factor Authentication")')).toBeVisible();
  });
});
