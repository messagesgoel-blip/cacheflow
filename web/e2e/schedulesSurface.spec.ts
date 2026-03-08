import { expect, test } from '@playwright/test'
import { primeQaSession } from './helpers/mockRuntime'

test('schedules surface renders current shell styling and opens the job modal', async ({ page, request }) => {
  await primeQaSession(page, request)

  await page.route('**/api/transfers?limit=50', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        transfers: [
          {
            jobId: 'transfer-1',
            fileName: 'Nightly Archive.tar.gz',
            fileSize: 2147483648,
            progress: 72,
            status: 'active',
            operation: 'copy',
            sourceProvider: 'google',
            destProvider: 'vps',
          },
        ],
      }),
    })
  })

  await page.route('**/api/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'job-1',
          name: 'Nightly Backup',
          jobType: 'backup-data',
          cronExpression: '0 2 * * *',
          enabled: true,
          lastRunAt: '2026-03-08T02:00:00.000Z',
          nextRunAt: '2026-03-09T02:00:00.000Z',
          createdAt: '2026-03-07T01:00:00.000Z',
          updatedAt: '2026-03-08T02:00:00.000Z',
        },
      ]),
    })
  })

  await page.goto('/schedules')
  await expect(page.getByTestId('cf-schedules-page')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Automation registry')).toBeVisible()
  await expect(page.getByTestId('cf-schedules-transfer-snapshot')).toBeVisible()
  await expect(page.getByTestId('cf-schedules-transfer-transfer-1')).toContainText('Nightly Archive.tar.gz')
  await expect(page.getByTestId('cf-schedules-transfer-transfer-1')).toContainText('72%')
  await expect(page.getByTestId('cf-schedule-job-job-1')).toContainText('Nightly Backup')
  await expect(page.getByTestId('cf-schedule-job-job-1')).toContainText('At 02:00')

  await page.getByRole('button', { name: 'New Job' }).click()
  await expect(page.getByText('Create Scheduled Job')).toBeVisible()
  await expect(page.getByText('Enable job immediately')).toBeVisible()
})
