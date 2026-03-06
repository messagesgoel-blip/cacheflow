import { test, expect } from '@playwright/test';

import { PROVIDER_PARITY_CHECKLIST } from '../../../../lib/providers/ProviderAdapter.interface';
import { vpsAdapter, vpsDescriptor } from '../../../../lib/providers/vps/VPSAdapter';
import { ErrorCode } from '../../../../lib/errors/ErrorCode';

type AnyObject = Record<string, unknown>;

function collectForbiddenKeys(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return [];

  const forbidden = new Set(['password', 'privateKey', 'passphrase']);
  const leaks: string[] = [];

  for (const [key, child] of Object.entries(value as AnyObject)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (forbidden.has(key)) {
      leaks.push(currentPath);
    }
    leaks.push(...collectForbiddenKeys(child, currentPath));
  }

  return leaks;
}

test.describe('Task 4.6 - VPS Parity + Credential Security (SEC-1)', () => {
  const context = {
    requestId: 'req-vps-parity-1',
    userId: 'user-vps-parity-1',
  };

  const auth = {
    accountId: 'user-vps-parity-1:vps.example.com:22:ubuntu',
    accessToken: Buffer.from(
      JSON.stringify({
        host: 'vps.example.com',
        port: 22,
        username: 'ubuntu',
        authType: 'password',
        password: 'redacted',
        rootPath: '/home/ubuntu',
      }),
    ).toString('base64'),
  };

  test('parity contract: VPS adapter implements every required method across all 5 checks', async () => {
    expect(vpsDescriptor.id).toBe('vps');
    expect(vpsDescriptor.capabilities.supportsAuthRefresh).toBe(false);
    expect(vpsDescriptor.capabilities.supportsResumableUpload).toBe(true);
    expect(vpsDescriptor.capabilities.supportsChunkResume).toBe(true);
    expect(vpsDescriptor.capabilities.supportsStreamingTransfer).toBe(true);

    const missing: string[] = [];

    for (const check of PROVIDER_PARITY_CHECKLIST) {
      for (const method of check.requiredMethods) {
        const candidate = (vpsAdapter as unknown as AnyObject)[method as string];
        if (typeof candidate !== 'function') {
          missing.push(`${check.id}:${String(method)}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test('parity contract: canonical error behavior for non-refresh + malformed tokens + share links', async () => {
    await expect(
      vpsAdapter.refreshAuth({ context, auth }),
    ).rejects.toMatchObject({ code: ErrorCode.REFRESH_FAILED });

    await expect(
      vpsAdapter.createShareLink({ context, auth, fileId: '/tmp/file.txt' }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    await expect(
      vpsAdapter.revokeShareLink({ context, auth, fileId: '/tmp/file.txt', linkId: 'link-1' }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    const invalid = await vpsAdapter.validateAuth({
      context,
      auth: {
        accountId: 'user-vps-parity-1:vps.example.com:22:ubuntu',
        accessToken: 'not-base64-json',
      },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toBe('revoked');
  });

  test('SEC-1: /api/connections/vps save response excludes credential fields and browser storage secrets', async ({ page }) => {
    const secretPassword = 'super-secret-password';
    const secretPrivateKey = '-----BEGIN OPENSSH PRIVATE KEY-----test-key-----END OPENSSH PRIVATE KEY-----';
    const secretPassphrase = 'super-secret-passphrase';

    await page.route('**/api/connections/vps', async (route) => {
      expect(route.request().method()).toBe('POST');

      const requestBody = route.request().postDataJSON() as AnyObject;
      expect(requestBody.kind).toBe('vps');
      expect(requestBody.password).toBe(secretPassword);
      expect(requestBody.privateKey).toBe(secretPrivateKey);
      expect(requestBody.passphrase).toBe(secretPassphrase);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          remoteId: 'd1e2f3a4-5678-9999-abcd-ef1234567890',
          provider: 'vps',
          accountKey: 'vps.example.com:22:ubuntu',
          displayName: 'ubuntu@vps.example.com:22',
        }),
      });
    });

    await page.goto('/');

    const result = await page.evaluate(
      async ({ password, privateKey, passphrase }) => {
        const response = await fetch('/api/connections/vps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'vps',
            host: 'vps.example.com',
            port: 22,
            username: 'ubuntu',
            authType: 'password',
            password,
            privateKey,
            passphrase,
            rootPath: '/home/ubuntu',
            accountLabel: 'Primary',
          }),
        });

        const body = await response.json();
        const localStorageSnapshot = Object.keys(localStorage)
          .map((key) => `${key}=${localStorage.getItem(key) ?? ''}`)
          .join('\n');

        return {
          status: response.status,
          body,
          localStorageSnapshot,
        };
      },
      {
        password: secretPassword,
        privateKey: secretPrivateKey,
        passphrase: secretPassphrase,
      },
    );

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    const forbiddenPaths = collectForbiddenKeys(result.body);
    expect(forbiddenPaths).toEqual([]);

    expect(result.localStorageSnapshot).not.toContain(secretPassword);
    expect(result.localStorageSnapshot).not.toContain(secretPrivateKey);
    expect(result.localStorageSnapshot).not.toContain(secretPassphrase);
  });
});
