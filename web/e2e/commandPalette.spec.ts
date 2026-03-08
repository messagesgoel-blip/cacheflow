import { test, expect } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page, request }) => {
    const connections: MockConnection[] = [
      {
        id: 'g1',
        remoteId: 'g1',
        provider: 'google',
        accountKey: 'g1',
        accountEmail: 'username@gmail.com',
        accountLabel: 'Google Drive A',
      },
    ]

    const files = [
      {
        id: 'g-folder-1',
        name: 'Folder from GOOGLE A',
        mimeType: 'application/vnd.google-apps.folder',
        size: '0',
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
      },
      {
        id: 'g-file-1',
        name: 'GOOGLE A.txt',
        mimeType: 'text/plain',
        size: '1024',
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
      },
    ]

    const activity = [
      {
        id: 'activity-upload',
        action: 'upload',
        resource: 'file',
        resource_id: 'file-1',
        created_at: new Date('2026-03-08T06:00:00.000Z').toISOString(),
        metadata: {
          fileName: 'Launch Notes.md',
          providerId: 'google',
          path: '/Launch Notes.md',
          size_bytes: 1024,
        },
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

      if (url.includes('drive/v3/files?') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
        return {
          json: {
            files,
            nextPageToken: null,
          },
        }
      }

      return { json: {} }
    }, { activity })

    await page.route('**/api/jobs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('opens real file and provider actions from the shell palette', async ({ page }) => {
    await gotoFilesAndWait(page)
    await page.getByTestId('cf-sidebar-account-g1').click()
    await expect(page.getByTestId('cf-file-row').first()).toBeVisible({ timeout: 15000 })

    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('cf-command-palette')).toBeVisible()
    await page.getByPlaceholder('Type a route or action').fill('create folder')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('cf-new-folder-name')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('cf-new-folder-name')).not.toBeVisible()

    await page.getByTestId('cf-command-palette-trigger').click()
    await expect(page.getByTestId('cf-command-palette')).toBeVisible()
    await page.getByPlaceholder('Type a route or action').fill('connect vps')
    await page.getByTestId('cf-command-item-connect-vps').click()
    await expect(page).toHaveURL(/\/providers/)
    await expect(page.getByRole('heading', { name: 'Connect VPS / SFTP' })).toBeVisible({ timeout: 15000 })
  })

  test('opens activity and schedule compose entry points from the shell palette', async ({ page }) => {
    await gotoFilesAndWait(page)

    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('cf-command-palette')).toBeVisible()
    await page.getByPlaceholder('Type a route or action').fill('activity')
    await page.getByTestId('cf-command-item-go-activity').click()

    await expect(page).toHaveURL(/\/files\?view=activity/)
    await expect(page.getByTestId('cf-activity-feed')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Activity Feed' })).toBeVisible()
    await expect(page.getByTestId('cf-activity-filter-action')).toBeVisible()

    await page.getByTestId('cf-command-palette-trigger').click()
    await expect(page.getByTestId('cf-command-palette')).toBeVisible()
    await page.getByPlaceholder('Type a route or action').fill('schedule')
    await page.getByTestId('cf-command-item-new-schedule').click()

    await expect(page).toHaveURL(/\/schedules\?compose=new/)
    await expect(page.getByText('Create Scheduled Job')).toBeVisible({ timeout: 15000 })
  })
})
