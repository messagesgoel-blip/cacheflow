/**
 * Playwright Global Teardown
 * 
 * Cleanup after E2E tests complete.
 * 
 * Gate: QA-1
 * Task: OPS-E2E-READY@QA-1
 */

import { FullConfig } from '@playwright/test';

/**
 * Global teardown function - called once after all tests
 */
export default async function globalTeardown(config: FullConfig): Promise<void> {
  const setupTime = process.env.E2E_SETUP_DURATION_MS || '0';
  
  console.log('\n========================================');
  console.log('CacheFlow E2E Test Suite - Teardown');
  console.log('========================================\n');
  console.log(`[E2E Teardown] Total setup time: ${setupTime}ms`);
  console.log('[E2E Teardown] Cleanup complete\n');
  
  // Clear environment variables
  delete process.env.E2E_SETUP_TIMESTAMP;
  delete process.env.E2E_SETUP_DURATION_MS;
}

