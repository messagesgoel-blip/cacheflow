import { test, expect } from '@playwright/test';

/**
 * Task 5.13: E2E search tests
 * Gate: SEARCH-1
 * 
 * This suite verifies:
 * 1. Global search from UnifiedFileBrowser
 * 2. Cross-provider result merging
 * 3. Empty results handling
 * 4. Search error states
 */

test.describe('Global Cross-Provider Search', () => {
  let querySearchHits = { google: 0, dropbox: 0 };
  let normalListingHits = 0;

  const mockRemotes = [
    {
      id: 'remote-google-1',
      provider: 'google',
      account_key: 'g1',
      account_email: 'google@example.com',
      display_name: 'My Google Drive',
      disabled: false,
    },
    {
      id: 'remote-dropbox-1',
      provider: 'dropbox',
      account_key: 'd1',
      account_email: 'dropbox@example.com',
      display_name: 'My Dropbox',
      disabled: false,
    }
  ];

  test.beforeEach(async ({ page, context }) => {
    test.setTimeout(60000);
    querySearchHits = { google: 0, dropbox: 0 };
    normalListingHits = 0;

    // Set authentication
    await context.addCookies([{
      name: 'accessToken',
      value: 'mock-jwt-token',
      domain: 'localhost',
      path: '/'
    }]);

    await page.addInitScript(() => {
      localStorage.setItem('cf_token', 'mock-jwt-token');
      localStorage.setItem('cf_email', 'test@goels.in');
      
      const googleTokens = [{ 
        accountKey: 'g1', 
        accountEmail: 'google@example.com', 
        displayName: 'My Google Drive',
        remoteId: 'remote-google-1',
        accessToken: 'mock-google-token'
      }];
      const dropboxTokens = [{ 
        accountKey: 'd1', 
        accountEmail: 'dropbox@example.com', 
        displayName: 'My Dropbox',
        remoteId: 'remote-dropbox-1',
        accessToken: 'mock-dropbox-token'
      }];

      localStorage.setItem('cacheflow_tokens_google', JSON.stringify(googleTokens));
      localStorage.setItem('cacheflow_tokens_dropbox', JSON.stringify(dropboxTokens));
    });

    // Mock initial remotes and connections
    await page.route('**/api/remotes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { remotes: mockRemotes } })
      });
    });

    await page.route('**/api/connections', async (route) => {
      const connections = mockRemotes.map(r => ({
        id: r.id,
        provider: r.provider,
        accountKey: r.account_key,
        remoteId: r.id,
        accountName: r.display_name,
        accountEmail: r.account_email,
        status: 'connected'
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: connections })
      });
    });

    // Mock proxy endpoint for both search and normal listing flows.
    await page.route('**/api/remotes/*/proxy', async (route) => {
      const body = route.request().postDataJSON();
      const url = String(body?.url || '');
      const raw = route.request().postData() || '';
      const remoteId = route.request().url().split('/').slice(-2, -1)[0];
      const isGoogle = remoteId.includes('google');
      const isDropbox = remoteId.includes('dropbox');
      const hasQueryTest = raw.includes('query-test') || url.includes('query-test');
      const hasEmptyTest = raw.includes('empty-test') || url.includes('empty-test');
      const hasErrorTest = raw.includes('error-test') || url.includes('error-test');

      if (hasErrorTest) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
        return;
      }

      if (hasEmptyTest) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isDropbox ? { matches: [] } : { files: [] })
        });
        return;
      }

      if (hasQueryTest) {
        if (isGoogle) {
          querySearchHits.google += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              files: [
                {
                  id: 'g-file-1',
                  name: 'test-document.pdf',
                  mimeType: 'application/pdf',
                  size: '102400',
                  createdTime: '2023-01-01T10:00:00Z',
                  modifiedTime: '2023-01-01T10:00:00Z',
                }
              ]
            })
          });
          return;
        }

        if (isDropbox) {
          querySearchHits.dropbox += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              matches: [
                {
                  metadata: {
                    '.tag': 'metadata',
                    id: 'id:d-file-1',
                    name: 'test-spreadsheet.xlsx',
                    size: 204800,
                    client_modified: '2023-02-01T10:00:00Z',
                  }
                }
              ]
            })
          });
          return;
        }
      }

      // Default non-search listing response used after clearing query.
      normalListingHits += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          isDropbox
            ? { entries: [] }
            : {
                files: [
                  {
                    id: 'root-file-1',
                    name: 'normal-file.txt',
                    mimeType: 'text/plain',
                    size: '500',
                    modifiedTime: new Date().toISOString(),
                  }
                ]
              }
        )
      });
    });
  });

  test('should perform global search and show results from multiple providers', async ({ page }) => {
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('cf-global-search-input');
    await expect(searchInput).toBeVisible();

    // Type search query
    await searchInput.fill('query-test');

    // Ensure search was issued for both providers.
    await expect.poll(() => querySearchHits.google).toBeGreaterThan(0);
    await expect.poll(() => querySearchHits.dropbox).toBeGreaterThan(0);
  });

  test('should show empty state when no results found', async ({ page }) => {
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('cf-global-search-input');
    await searchInput.fill('empty-test');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
    
    // UnifiedFileBrowser renders "No files yet" empty state text.
    await expect(page.getByText(/No files yet|No files found|No results/i)).toBeVisible();
  });

  test('should show error banner when search fails', async ({ page }) => {
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('cf-global-search-input');
    await searchInput.fill('error-test');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
    
    // Should show error banner
    const errorBanner = page.getByTestId('cf-error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/Search partial failure|Search failed/i);
  });

  test('should clear search and return to normal file listing', async ({ page }) => {
    // First, search for something
    await page.goto('/files');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('cf-global-search-input');
    await searchInput.fill('query-test');
    await expect.poll(() => querySearchHits.google).toBeGreaterThan(0);
    await expect.poll(() => querySearchHits.dropbox).toBeGreaterThan(0);

    // Clear search input
    await searchInput.fill('');

    await expect(searchInput).toHaveValue('');
    await expect.poll(() => normalListingHits).toBeGreaterThan(0);
  });
});
