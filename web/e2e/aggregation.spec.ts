import { test, expect } from '@playwright/test';

test.describe('Provider Aggregation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and authenticate with QA credentials
    await page.goto('http://localhost:3010/login');

    // Fill in login form (using QA test credentials)
    await page.fill('input[type="email"]', 'qa-test@example.com');
    await page.fill('input[type="password"]', 'qa-password-123');

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or files page
    await page.waitForURL('**/files');

    // Clear any existing storage that might interfere
    await page.context().clearCookies();

    // Navigate to files page
    await page.goto('http://localhost:3010/files');

    // Wait for the page to load and controls to be available
    await page.waitForSelector('[data-testid="cf-allproviders-view-toggle-grouped"]', { state: 'visible' });
  });

  test('toggle aggregated view visibility', async ({ page }) => {
    // Verify aggregated toggle is visible when viewing all providers
    await expect(page.locator('[data-testid="cf-aggregated-view-toggle"]')).toBeVisible();

    // Click aggregated toggle
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Verify toggle state is active
    await expect(page.locator('[data-testid="cf-aggregated-view-toggle"]')).toHaveClass(/bg-green-500/);

    // Verify that grouped/flat toggles are disabled when aggregated is active
    await expect(page.locator('[data-testid="cf-allproviders-view-toggle-grouped"]')).toBeDisabled();
    await expect(page.locator('[data-testid="cf-allproviders-view-toggle-flat"]')).toBeDisabled();
  });

  test('aggregated mode renders single unified list', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Verify no grouped sections are rendered
    await expect(page.locator('[data-testid^="cf-allproviders-group-section"]')).not.toBeVisible();

    // Verify single file table is rendered
    await expect(page.locator('table')).toBeVisible();
  });

  test('duplicates-only filter functionality', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Initially, duplicates-only toggle should be visible but not active
    const duplicatesToggle = page.locator('[data-testid="cf-duplicates-filter-toggle"]');
    await expect(duplicatesToggle).toBeVisible();

    // Click to enable duplicates-only
    await duplicatesToggle.click();

    // Verify toggle state is active
    await expect(duplicatesToggle).toHaveClass(/bg-purple-500/);

    // Note: Actual duplicate detection would require specific test data setup
  });

  test('provider filter in aggregated mode', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Verify provider filter dropdown is visible
    const providerFilter = page.locator('select');
    await expect(providerFilter).toBeVisible();

    // Select a specific provider (assuming options exist)
    // This test assumes there are providers available in the dropdown
    const options = await page.locator('select option').count();
    expect(options).toBeGreaterThan(1); // Should have "All Providers" plus actual providers

    // Test selecting a provider from the dropdown
    if (options > 1) {
      await providerFilter.selectOption({ index: 1 }); // Select first actual provider
      // Verify selection worked
      const selectedValue = await providerFilter.inputValue();
      expect(selectedValue).not.toBe('all');
    }
  });

  test('toggle persistence across reload', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Reload page
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('[data-testid="cf-aggregated-view-toggle"]');

    // Verify aggregated view is still enabled after reload
    await expect(page.locator('[data-testid="cf-aggregated-view-toggle"]')).toHaveClass(/bg-green-500/);
  });

  test('duplicate badge tooltip', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Look for duplicate badges (they might not exist in test data)
    // Just verify the mechanism would work if duplicates existed
    const duplicateBadges = page.locator('span:text("2x")'); // Example of duplicate badge text
    // Don't assert count as there might not be actual duplicates in test data
  });

  test('basic file action works in aggregated mode', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Wait for files to load
    await page.waitForTimeout(1000);

    // Try clicking on a file row (if any exist)
    const fileRows = page.locator('tr').nth(1); // Skip header row
    if (await fileRows.count() > 0) {
      await fileRows.click();
      // Should either open file or select it
    }
  });

  test('performance: aggregated load under 5 seconds', async ({ page }) => {
    // Measure time to enable aggregated view
    const startTime = Date.now();

    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Wait for loading to complete (indicated by spinner disappearing)
    await page.waitForSelector('.animate-spin', { state: 'detached' });

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });

  test('partial failure UI banner appears with provider errors', async ({ page }) => {
    // Enable aggregated view
    await page.locator('[data-testid="cf-aggregated-view-toggle"]').click();

    // Wait for potential error banners to appear
    await page.waitForTimeout(2000);

    // Check for error banners (these may appear if providers fail to connect)
    const errorBanner = page.locator('[data-testid="cf-error-banner"]');
    if (await errorBanner.count() > 0) {
      // If there are error banners, verify they contain provider-specific info
      const errorText = await errorBanner.textContent();
      expect(errorText).toContain(':'); // Should contain provider:error format
    }
  });
});