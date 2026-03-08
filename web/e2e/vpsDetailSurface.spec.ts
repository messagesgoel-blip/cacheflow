import { expect, test } from '@playwright/test'

test('vps detail page uses shell layout and mock-run controls', async ({ page }) => {
  await page.route('**/api/providers/vps/test-vps/files?path=*', async (route) => {
    const url = new URL(route.request().url())
    const path = url.searchParams.get('path') || '/'

    if (path === '/') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { name: 'mock run', type: 'dir', size: 0, modifiedAt: '2026-03-08T10:00:00.000Z' },
          { name: 'notes.txt', type: 'file', size: 1024, modifiedAt: '2026-03-08T10:05:00.000Z' },
        ]),
      })
      return
    }

    if (path === '/srv/storage/local/mock run') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { name: 'archive', type: 'dir', size: 0, modifiedAt: '2026-03-08T10:10:00.000Z' },
          { name: 'pw-sample.txt', type: 'file', size: 2048, modifiedAt: '2026-03-08T10:12:00.000Z' },
        ]),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/providers/vps/test-vps')
  const shell = page.getByTestId('cf-vps-detail-shell')
  await expect(shell).toBeVisible({ timeout: 15000 })
  await expect(shell.getByText('VPS File Browser')).toBeVisible()
  await expect(shell.getByText('Connection ID').first()).toBeVisible()
  await expect(shell.getByText('Current Path').first()).toBeVisible()

  await shell.getByRole('button', { name: 'Mock Run', exact: true }).click()
  await expect(shell.getByText('/srv/storage/local/mock run').first()).toBeVisible()
  await expect(page.getByTestId('cf-vps-row-archive')).toBeVisible()
  await expect(page.getByTestId('cf-vps-row-pw-sample.txt')).toContainText('2.0 KB')
})
