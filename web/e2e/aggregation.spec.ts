import { expect, test } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test.describe('Provider Aggregation', () => {
  test.beforeEach(async ({ page, request }) => {
    const connections: MockConnection[] = [
      {
        id: 'g1',
        remoteId: 'g1',
        provider: 'google',
        accountKey: 'g1',
        accountEmail: 'google@example.com',
        accountLabel: 'Google Drive A',
      },
      {
        id: 'd1',
        remoteId: 'd1',
        provider: 'dropbox',
        accountKey: 'd1',
        accountEmail: 'dropbox@example.com',
        accountLabel: 'Dropbox B',
      },
    ]

    await primeQaSession(page, request)
    await installMockRuntime(page, connections, async ({ url }) => {
      if (url.includes('about?fields=storageQuota')) {
        return {
          json: {
            storageQuota: {
              usage: '1024',
              limit: '1048576',
            },
          },
        }
      }

      if (url.includes('/users/get_space_usage')) {
        return {
          json: {
            allocation: { allocated: 1048576 },
            used: 1024,
          },
        }
      }

      if (url.includes('drive/v3/files?') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
        return {
          json: {
            files: [],
            nextPageToken: null,
          },
        }
      }

      if (url.includes('/files/list_folder')) {
        return {
          json: {
            entries: [],
            has_more: false,
            cursor: 'mock-cursor',
          },
        }
      }

      return { json: {} }
    })

    await gotoFilesAndWait(page)
    await expect(page.getByTestId('cf-allproviders-view-toggle-grouped')).toBeVisible({ timeout: 15000 })
  })

  test('toggle aggregated view visibility', async ({ page }) => {
    const aggregatedToggle = page.getByTestId('cf-aggregated-view-toggle')
    await expect(aggregatedToggle).toBeVisible()

    await aggregatedToggle.click()

    await expect(aggregatedToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('cf-allproviders-view-toggle-grouped')).toBeDisabled()
    await expect(page.getByTestId('cf-allproviders-view-toggle-flat')).toBeDisabled()
  })

  test('aggregated mode renders single unified list', async ({ page }) => {
    await page.getByTestId('cf-aggregated-view-toggle').click()

    await expect(page.locator('[data-testid^="cf-allproviders-group-section"]')).toHaveCount(0)
    await expect(page.getByText(/No files yet/i)).toBeVisible()
  })

  test('duplicates-only filter functionality', async ({ page }) => {
    await page.getByTestId('cf-aggregated-view-toggle').click()

    const duplicatesToggle = page.getByTestId('cf-duplicates-filter-toggle')
    await expect(duplicatesToggle).toBeVisible()

    await duplicatesToggle.click()
    await expect(duplicatesToggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('provider filter in aggregated mode', async ({ page }) => {
    await page.getByTestId('cf-aggregated-view-toggle').click()

    const providerFilter = page.locator('select[aria-label="Filter providers"]')
    await expect(providerFilter).toBeVisible()
    await expect(providerFilter.locator('option')).toHaveCount(3)

    await providerFilter.selectOption('google')
    await expect(providerFilter).toHaveValue('google')
  })

  test.skip('toggle persistence across reload', async ({ page }) => {
    await page.getByTestId('cf-aggregated-view-toggle').click()
    await page.reload()
    await expect(page.getByTestId('cf-aggregated-view-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  test('basic file action surface still renders in aggregated mode', async ({ page }) => {
    await page.getByTestId('cf-aggregated-view-toggle').click()
    await expect(page.getByText(/No files yet/i)).toBeVisible()
  })
})
