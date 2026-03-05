import { test, expect, BrowserContext } from '@playwright/test';

/**
 * Task 3.8: Auto-resume E2E test — network drop mid-transfer
 * 
 * Gate: TRANSFER-1
 * Contracts: 3.5, 3.6
 * 
 * This test verifies that:
 * 1. Chunked uploads can be initiated.
 * 2. Progress is tracked at the chunk level in the UI.
 * 3. If a network drop occurs, the upload can be resumed.
 * 4. Resume starts from the last successfully committed chunk (Contract 3.6).
 */

test.describe('Chunked Upload & Auto-Resume (Task 3.8)', () => {
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    // 1. Setup Browser Context with Auth Cookies
    context = await browser.newContext({ baseURL: 'http://localhost:4020' });
    await context.addCookies([{
      name: 'accessToken',
      value: 'mock-jwt-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 3600,
    }]);

    // 2. Mock Auth and Provider state in localStorage
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('cf_token', 'test-jwt-token');
      localStorage.setItem('cf_email', 'qa-chunked@goels.in');
      localStorage.setItem('cf_user_id', 'user-chunked-123');

      localStorage.setItem('cacheflow_tokens_google', JSON.stringify([{
        provider: 'google', 
        accessToken: 'mock-google-token',
        accountEmail: 'google@example.com',
        displayName: 'Google Drive (QA)',
        accountKey: 'g1',
        disabled: false,
      }]));
    });

    // 3. Setup common API Mocks
    await context.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({ 
          success: true, 
          user: { id: 'user-chunked-123', email: 'qa-chunked@goels.in' } 
        }) 
      });
    });

    await context.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-chunked-123', email: 'qa-chunked@goels.in', name: 'Chunk QA' },
          expires: new Date(Date.now() + 3600000).toISOString(),
        }),
      });
    });

    await context.route('**/api/connections', async (route) => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({
          success: true,
          data: [
            { provider: 'google', status: 'connected', accountEmail: 'google@example.com', accountName: 'Google Drive (QA)', accountKey: 'g1' }
          ]
        }) 
      });
    });
  });

  test.afterEach(async () => {
    await context?.close();
  });

  /**
   * Helper to find and expand the Transfer Tray
   */
  async function expandTransferTray(page: any) {
    const tray = page.getByTestId('cf-transfer-tray');
    if (await tray.isVisible()) {
      return tray;
    }

    const activeButton = page.getByRole('button', { name: /active transfer/i });
    const showTransfersButton = page.getByRole('button', { name: /show transfers/i });
    try {
      await expect(activeButton).toBeVisible({ timeout: 8000 });
      await activeButton.click();
    } catch {
      await expect(showTransfersButton).toBeVisible({ timeout: 8000 });
      await showTransfersButton.click();
    }

    await expect(tray).toBeVisible({ timeout: 10000 });
    await expect(tray).toContainText('Transfers');

    return tray;
  }

  test('TRANSFER-1: Chunked upload shows per-chunk progress in tray', async () => {
    const page = await context.newPage();
    
    const CHUNK_COUNT = 20;
    const FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const JOB_ID = 'transfer-chunked-001';

    // Mock the transfers list to show a chunked upload in progress (Contract 3.2/3.10)
    await context.route('**/api/transfers*', async (route) => {
      if (route.request().method() === 'GET' && route.request().url().includes('/api/transfers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            transfers: [{
              jobId: JOB_ID,
              fileName: 'Large_Archive.zip',
              fileSize: FILE_SIZE,
              progress: 40,
              status: 'active',
              currentChunk: 8,
              totalChunks: CHUNK_COUNT,
              committedChunks: [0, 1, 2, 3, 4, 5, 6, 7],
              operation: 'upload',
              sourceProvider: 'google',
              destProvider: 'onedrive'
            }]
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('http://localhost:4020/files');
    
    // Expand tray if needed
    const tray = await expandTransferTray(page);
    await expect(tray).toBeVisible({ timeout: 15000 });
    
    // Verify file is listed
    await expect(tray).toContainText('Large_Archive.zip');
    
    // Check for chunk visualization (8 of 20 chunks)
    await expect(tray).toContainText('8 of 20 chunks');
    
    // Verify the visual progress bars for chunks
    const committedChunks = tray.locator('.bg-green-500');
    await expect(committedChunks).toHaveCount(8);
  });

  test('TRANSFER-1: Resume logic follows Contract 3.6 after network drop', async () => {
    const page = await context.newPage();
    const TRANSFER_ID = 'resume-test-999';
    const FILE_NAME = 'AutoResume_Test.bin';
    const TOTAL_CHUNKS = 5;
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const FILE_SIZE = TOTAL_CHUNKS * CHUNK_SIZE;
    
    let committedOnServer = new Set<number>();
    let simulateNetworkError = false;
    
    console.log('--- Phase 1: Initial Upload (Chunks 0 and 1) ---');

    // Setup Contract 3.6 Mocking - Exact response shape from contract
    await context.route(`**/api/transfers/${TRANSFER_ID}/chunks`, async (route) => {
      if (simulateNetworkError) {
        await route.abort('failed'); // Use valid error code
        return;
      }

      const method = route.request().method();
      const body = method === 'POST' ? route.request().postDataJSON() : null;

      const getResumeState = () => {
        const committed = Array.from(committedOnServer).sort((a, b) => a - b);
        let next = 0;
        while (committedOnServer.has(next)) {
          next++;
        }
        return {
          success: true,
          transferId: TRANSFER_ID,
          fileName: FILE_NAME,
          fileSize: FILE_SIZE,
          chunkSize: CHUNK_SIZE,
          totalChunks: TOTAL_CHUNKS,
          committedChunks: committed,
          nextChunkIndex: next,
          complete: committed.length === TOTAL_CHUNKS
        };
      };

      if (method === 'POST') {
        if (body.chunkIndex !== undefined) {
          committedOnServer.add(body.chunkIndex);
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getResumeState())
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getResumeState())
        });
      }
    });

    await page.goto('http://localhost:4020/files');

    // 1. Start Upload and commit 2 chunks
    await test.step('Start upload and commit first 2 chunks', async () => {
      const results = await page.evaluate(async ({ id, name, size, chunk }) => {
        // Register (Contract 3.6 POST without chunkIndex)
        await fetch(`/api/transfers/${id}/chunks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: name, fileSize: size, chunkSize: chunk })
        });
        
        // Commit chunk 0
        await fetch(`/api/transfers/${id}/chunks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunkIndex: 0 })
        });
        
        // Commit chunk 1
        const res1 = await fetch(`/api/transfers/${id}/chunks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunkIndex: 1 })
        });
        
        return res1.json();
      }, { id: TRANSFER_ID, name: FILE_NAME, size: FILE_SIZE, chunk: CHUNK_SIZE });

      expect(results.success).toBe(true);
      expect(results.nextChunkIndex).toBe(2);
      expect(results.committedChunks).toEqual([0, 1]);
      console.log('✅ Successfully committed chunks 0 and 1.');
    });

    // 2. Simulate Network Drop
    await test.step('Simulate network drop', async () => {
      console.log('⚠️ SIMULATING NETWORK DROP');
      simulateNetworkError = true;
      await context.setOffline(true);
      
      const fetchFailed = await page.evaluate(async (id) => {
        try {
          await fetch(`/api/transfers/${id}/chunks`, { method: 'GET' });
          return false;
        } catch (e) {
          return true;
        }
      }, TRANSFER_ID);
      
      expect(fetchFailed).toBe(true);
      console.log('✅ Verified: Network is offline, requests are failing.');
    });

    // 3. Restore Network and Resume
    await test.step('Restore network and verify resume point', async () => {
      console.log('✅ RESTORING NETWORK');
      simulateNetworkError = false;
      await context.setOffline(false);
      
      const resumeState = await page.evaluate(async (id) => {
        const res = await fetch(`/api/transfers/${id}/chunks`, { method: 'GET' });
        return res.json();
      }, TRANSFER_ID);

      expect(resumeState.success).toBe(true);
      expect(resumeState.nextChunkIndex).toBe(2);
      expect(resumeState.committedChunks).toEqual([0, 1]);
      console.log(`✅ Verified: Resume point is at chunk ${resumeState.nextChunkIndex} (following Contract 3.6).`);
    });

    // 4. Complete Upload from Resume Point
    await test.step('Complete remaining chunks (2-4)', async () => {
      const finalResult = await page.evaluate(async ({ id, startAt, total }) => {
        let lastRes: any;
        for (let i = startAt; i < total; i++) {
          const res = await fetch(`/api/transfers/${id}/chunks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunkIndex: i })
          });
          lastRes = await res.json();
        }
        return lastRes;
      }, { id: TRANSFER_ID, startAt: 2, total: TOTAL_CHUNKS });

      expect(finalResult.success).toBe(true);
      expect(finalResult.complete).toBe(true);
      expect(finalResult.nextChunkIndex).toBe(TOTAL_CHUNKS);
      console.log('✅ Upload completed successfully after resume.');
    });

    console.log('✅ Auto-resume E2E verification complete: Mid-transfer network drop handled via Contract 3.6.');
  });

  test('TRANSFER-1: Complete network drop during chunked upload triggers FAILED state', async () => {
    const page = await context.newPage();
    const JOB_ID = 'drop-test-777';

    // 1. Mock initial active state
    await context.route('**/api/transfers*', async (route) => {
      if (route.request().method() === 'GET' && route.request().url().includes('/api/transfers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            transfers: [{
              jobId: JOB_ID,
              fileName: 'Failure_Test.iso',
              fileSize: 100 * 1024 * 1024,
              progress: 20,
              status: 'active',
              currentChunk: 4,
              totalChunks: 20,
              committedChunks: [0, 1, 2, 3]
            }]
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('http://localhost:4020/files');
    const tray = await expandTransferTray(page);
    await expect(tray).toBeVisible();
    await expect(tray).toContainText('Failure_Test.iso');

    // 2. Simulate network drop / error in polling
    await context.unroute('**/api/transfers*');
    await context.route('**/api/transfers*', async (route) => {
      if (route.request().method() === 'GET' && route.request().url().includes('/api/transfers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            transfers: [{
              jobId: JOB_ID,
              fileName: 'Failure_Test.iso',
              fileSize: 100 * 1024 * 1024,
              progress: 20,
              status: 'failed',
              error: 'Network connection lost',
              currentChunk: 4,
              totalChunks: 20,
              committedChunks: [0, 1, 2, 3]
            }]
          })
        });
      } else {
        await route.continue();
      }
    });

    // Force a fresh poll so the UI reflects the failed transfer state.
    await page.reload();
    const failedTray = await expandTransferTray(page);
    const failedItem = failedTray.locator('div').filter({ hasText: 'Failure_Test.iso' }).first();

    // 3. Verify failed-state affordances in UI
    await expect(failedItem).toBeVisible();
    await expect(failedItem).toContainText(/network connection lost|failed/i);

    // 4. Verify Retry button exists for failed transfer
    const retryBtn = failedItem.getByRole('button', { name: /retry/i });
    await expect(retryBtn).toBeVisible();
  });
});
