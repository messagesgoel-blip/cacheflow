/**
 * Playwright Global Setup
 * 
 * Preflight checks before running E2E tests:
 * 1. Wait for API server to be ready on 127.0.0.1:8100
 * 2. Clear fail messages for unambiguous error reporting
 * 
 * Gate: QA-1
 * Task: OPS-E2E-READY@QA-1
 */

import { FullConfig } from '@playwright/test';

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:8100';
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if API is ready by making a health check request
 */
async function checkApiReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for API to be ready with retries
 */
async function waitForApi(): Promise<void> {
  console.log(`[E2E Preflight] Waiting for API at ${API_BASE_URL}...`);
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const isReady = await checkApiReady();
    
    if (isReady) {
      console.log(`[E2E Preflight] ✅ API is ready after ${attempt} attempt(s)`);
      return;
    }
    
    if (attempt < MAX_RETRIES) {
      console.log(`[E2E Preflight] Attempt ${attempt}/${MAX_RETRIES} - API not ready, retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  
  // Clear fail message - explicit about what failed
  throw new Error(
    `\n❌ E2E Preflight Failed: API not reachable\n` +
    `   URL: ${API_BASE_URL}\n` +
    `   Attempts: ${MAX_RETRIES}\n` +
    `   Timeout: ${MAX_RETRIES * RETRY_DELAY_MS / 1000}s\n\n` +
    `   Troubleshooting:\n` +
    `   1. Ensure API server is running: npm run dev (API port 8100)\n` +
    `   2. Check API logs for startup errors\n` +
    `   3. Verify port 8100 is not blocked by firewall\n` +
    `   4. Set PLAYWRIGHT_API_URL env var if using non-default port\n`
  );
}

/**
 * Global setup function - called once before all tests
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('CacheFlow E2E Test Suite - Preflight');
  console.log('========================================\n');
  
  const startTime = Date.now();
  
  // Wait for API to be ready
  await waitForApi();
  
  const setupTime = Date.now() - startTime;
  console.log(`\n[E2E Preflight] Setup completed in ${setupTime}ms\n`);
  
  // Store setup metadata for tests to access
  process.env.E2E_SETUP_TIMESTAMP = Date.now().toString();
  process.env.E2E_SETUP_DURATION_MS = setupTime.toString();
}
