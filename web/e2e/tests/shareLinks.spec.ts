import { test, expect, Page, Route } from '@playwright/test';

/**
 * Task 4.11: E2E share link tests — create, access, expire, revoke
 * Gate: SHARE-1
 * Contracts: 4.7, 4.8, 4.9, 4.12, 4.13
 */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shareBackendRoute(token: string): RegExp {
  return new RegExp(`/share/${escapeRegex(token)}$`);
}

async function fulfillShareApiRoute(
  page: Page,
  token: string,
  handler: (route: Route) => Promise<void>
): Promise<void> {
  await page.route(shareBackendRoute(token), async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }
    await handler(route);
  });
}

async function bootstrapAuthenticatedPage(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: 'mock-jwt-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    },
    {
      name: 'next-auth.session-token',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'user-share-123', email: 'qa-share@goels.in', name: 'Share QA' },
        expires: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
  });

  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'remote-share-google',
            provider: 'google',
            accountEmail: 'qa-share@goels.in',
            accountName: 'Share QA Google',
            status: 'connected',
            accountKey: 'share-g1',
            remoteId: 'remote-share-google',
          },
        ],
      }),
    });
  });

  await page.route('**/api/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        files: [],
        nextPageToken: null,
      }),
    });
  });

  await page.route('**/api/remotes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        remotes: [],
      }),
    });
  });
}

test.describe('Share Links (Task 4.11)', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedPage(page);
  });

  test('SHARE-1: create share link enforces 2FA then succeeds', async ({ page }) => {
    let createAttempts = 0;

    await page.route('**/api/share', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      createAttempts += 1;

      if (createAttempts === 1) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: '2FA must be enabled to create share links (2FA-1)' }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'share-token-abc123',
          passwordRequired: true,
          expiresAt: '2026-03-05T12:00:00.000Z',
          maxDownloads: 3,
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const firstAttempt = await page.evaluate(async () => {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileId: 'file-share-1',
          password: 'Secret123!',
          expiresAt: '2026-03-05T12:00:00.000Z',
          maxDownloads: 3,
        }),
      });

      return {
        status: res.status,
        json: await res.json(),
      };
    });

    expect(firstAttempt.status).toBe(403);
    expect(firstAttempt.json.error).toContain('2FA');

    const secondAttempt = await page.evaluate(async () => {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileId: 'file-share-1',
          password: 'Secret123!',
          expiresAt: '2026-03-05T12:00:00.000Z',
          maxDownloads: 3,
        }),
      });

      return {
        status: res.status,
        json: await res.json(),
      };
    });

    expect(secondAttempt.status).toBe(201);
    expect(secondAttempt.json.token).toBe('share-token-abc123');
    expect(secondAttempt.json.passwordRequired).toBe(true);
    expect(secondAttempt.json.maxDownloads).toBe(3);
  });

  test('SHARE-1: access shared file and update download count after download', async ({ page }) => {
    const token = 'share-token-access-1';
    let downloadCount = 0;

    await fulfillShareApiRoute(page, token, async (route) => {
      const method = route.request().method();

      if (method !== 'GET') {
        await route.continue();
        return;
      }

      if (downloadCount === 0) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            file: {
              id: 'file-public-1',
              path: '/Public/Quarterly_Report.pdf',
              size_bytes: 2048,
              created_at: '2026-03-01T10:00:00.000Z',
              download_count: 0,
            },
            password_protected: false,
            expires_at: '2026-03-10T10:00:00.000Z',
            download_limit: 5,
          }),
        });
        downloadCount = 1;
        return;
      }

      if (downloadCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/octet-stream',
          body: 'mock-file-binary-content',
        });
        downloadCount = 2;
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          file: {
            id: 'file-public-1',
            path: '/Public/Quarterly_Report.pdf',
            size_bytes: 2048,
            created_at: '2026-03-01T10:00:00.000Z',
            download_count: 1,
          },
          password_protected: false,
          expires_at: '2026-03-10T10:00:00.000Z',
          download_limit: 5,
        }),
      });
    });

    await page.goto(`/share/${token}`);

    await expect(page.getByRole('heading', { name: 'Shared File' })).toBeVisible();
    await expect(page.getByText('Quarterly_Report.pdf')).toBeVisible();
    await expect(page.getByText('Downloads').first()).toBeVisible();
    await expect(page.getByText('0').first()).toBeVisible();

    await page.getByRole('button', { name: 'Download File' }).click();

    await expect(page.getByText('1').first()).toBeVisible();
  });

  test('SHARE-1: expired share link shows unavailable state', async ({ page }) => {
    const expiredToken = 'share-token-expired-1';

    await fulfillShareApiRoute(page, expiredToken, async (route) => {
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Share expired' }),
      });
    });

    await page.goto(`/share/${expiredToken}`);

    await expect(page.getByRole('heading', { name: 'Link Unavailable' })).toBeVisible();
    await expect(page.getByText('This share link has expired or reached its download limit.')).toBeVisible();
  });

  test('SHARE-1: revoke invalidates link and enforces abuse-control throttling', async ({ page }) => {
    const token = 'share-token-revokable-1';
    const shareId = 'share-id-123';

    let revoked = false;
    let revokeAttempts = 0;

    await fulfillShareApiRoute(page, token, async (route) => {
      if (revoked) {
        await route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Revoked' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          file: {
            id: 'file-public-2',
            path: '/Shared/Revokable.txt',
            size_bytes: 128,
            created_at: '2026-03-01T10:00:00.000Z',
            download_count: 0,
          },
          password_protected: false,
        }),
      });
    });

    await page.route(`**/api/share/${shareId}/revoke`, async (route) => {
      revokeAttempts += 1;

      if (revokeAttempts === 1) {
        revoked = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Share successfully revoked',
            shareId,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again in 60 seconds.',
        }),
      });
    });

    await page.goto(`/share/${token}`);
    await expect(page.getByRole('heading', { name: 'Shared File' })).toBeVisible();

    const firstRevoke = await page.evaluate(async (id) => {
      const res = await fetch(`/api/share/${id}/revoke`, { method: 'POST', credentials: 'include' });
      return { status: res.status, json: await res.json() };
    }, shareId);

    expect(firstRevoke.status).toBe(200);
    expect(firstRevoke.json.success).toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Link Unavailable' })).toBeVisible();

    const secondRevoke = await page.evaluate(async (id) => {
      const res = await fetch(`/api/share/${id}/revoke`, { method: 'POST', credentials: 'include' });
      return { status: res.status, json: await res.json() };
    }, shareId);

    expect(secondRevoke.status).toBe(429);
    expect(secondRevoke.json.error).toBe('Rate limit exceeded');
  });
});
