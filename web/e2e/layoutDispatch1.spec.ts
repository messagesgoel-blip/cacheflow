import fs from 'node:fs/promises'
import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test'
import { primeQaSession } from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow/layout-dispatch1'

type MockConnection = {
  id: string
  remoteId: string
  provider: string
  accountKey: string
  accountEmail: string
  accountLabel: string
  accountName: string
  status: 'connected' | 'disconnected' | 'error'
  quota?: { used: number; total: number }
  host?: string
  port?: number
  username?: string
  lastSyncAt?: string
}

function shotPath(name: string): string {
  return `${SHOTS_DIR}/${name}.png`
}

function quotaBytes(gb: number): number {
  return gb * 1024 * 1024 * 1024
}

async function ensureShotDir(): Promise<void> {
  await fs.mkdir(SHOTS_DIR, { recursive: true })
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds as { x: number; y: number; width: number; height: number }
}

async function seedAuthRuntime(
  page: Page,
  request: APIRequestContext,
  connections: MockConnection[],
): Promise<void> {
  await primeQaSession(page, request)

  await page.addInitScript((mockConnections: MockConnection[]) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('cf_token', 'mock-token')
    localStorage.setItem('cf_email', 'layout@cacheflow.test')

    const byProvider: Record<string, Array<Record<string, unknown>>> = {}
    for (const connection of mockConnections) {
      const token = {
        provider: connection.provider,
        accessToken: '',
        refreshToken: '',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        accountEmail: connection.accountEmail,
        displayName: connection.accountLabel,
        accountId: connection.accountKey,
        accountKey: connection.accountKey,
        disabled: false,
        remoteId: connection.remoteId,
        quota: connection.quota,
      }
      byProvider[connection.provider] ||= []
      byProvider[connection.provider].push(token)
    }

    for (const [provider, tokens] of Object.entries(byProvider)) {
      localStorage.setItem(`cacheflow_tokens_${provider}`, JSON.stringify(tokens))
    }
  }, connections)

  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: connections,
      }),
    })
  })

  await page.route('**/api/remotes/*/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { status: 'connected', healthy: true },
      }),
    })
  })

  await page.route('**/api/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          activity: [
            {
              id: 'activity-1',
              action: 'upload',
              resource: 'file',
              resource_id: 'file-1',
              created_at: new Date('2026-03-10T12:00:00.000Z').toISOString(),
              metadata: {
                fileName: 'Roadmap.md',
                providerId: 'google',
              },
            },
          ],
        },
      }),
    })
  })

  await page.route('**/api/transfers?limit=50', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        transfers: [
          {
            jobId: 'transfer-1',
            fileName: 'Quarterly Backup.tar.gz',
            fileSize: 2147483648,
            progress: 64,
            status: 'active',
            operation: 'copy',
            sourceProvider: 'google',
            destProvider: 'vps',
          },
        ],
      }),
    })
  })

  await page.route('**/api/auth/2fa/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false }),
    })
  })

  await page.route('**/api/favorites**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { favorites: [] },
      }),
    })
  })

  await page.route('**/api/providers/vps/*/files?path=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: [] }),
    })
  })

  await page.route('**/api/remotes/*/proxy', async (route) => {
    const payload = route.request().postDataJSON() as {
      url?: string
      method?: string
    }
    const url = payload?.url || ''

    if (url.includes('about?fields=storageQuota')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          storageQuota: {
            usage: String(quotaBytes(48)),
            limit: String(quotaBytes(100)),
          },
        }),
      })
      return
    }

    if (url.includes('/users/get_space_usage')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allocation: { allocated: quotaBytes(20) },
          used: quotaBytes(12),
        }),
      })
      return
    }

    if (url.includes('/users/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          space_usage: {
            used: quotaBytes(36),
            allocated: quotaBytes(80),
          },
        }),
      })
      return
    }

    if (url.includes('drive/v3/files') && !url.includes('alt=media') && !url.includes('fields=size,mimeType')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [
            {
              id: 'g-file-1',
              name: 'Roadmap.md',
              mimeType: 'text/markdown',
              size: '2048',
              parents: ['root'],
              modifiedTime: new Date('2026-03-10T12:00:00.000Z').toISOString(),
              createdTime: new Date('2026-03-10T11:00:00.000Z').toISOString(),
            },
          ],
          nextPageToken: null,
        }),
      })
      return
    }

    if (url.includes('/files/list_folder')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [],
          has_more: false,
          cursor: 'mock-cursor',
        }),
      })
      return
    }

    if (url.includes('/folders/0/items')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [],
          total_count: 0,
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
}

const dashboardConnections: MockConnection[] = [
  {
    id: 'remote-google-1',
    remoteId: 'remote-google-1',
    provider: 'google',
    accountKey: 'google-1',
    accountEmail: 'google@example.com',
    accountLabel: 'Google Drive',
    accountName: 'Google Drive',
    status: 'connected',
    quota: { used: quotaBytes(48), total: quotaBytes(100) },
  },
  {
    id: 'remote-dropbox-1',
    remoteId: 'remote-dropbox-1',
    provider: 'dropbox',
    accountKey: 'dropbox-1',
    accountEmail: 'dropbox@example.com',
    accountLabel: 'Dropbox Team',
    accountName: 'Dropbox Team',
    status: 'connected',
    quota: { used: quotaBytes(12), total: quotaBytes(20) },
  },
  {
    id: 'remote-vps-oci',
    remoteId: 'remote-vps-oci',
    provider: 'vps',
    accountKey: 'vps-oci',
    accountEmail: '',
    accountLabel: 'OCI',
    accountName: 'OCI',
    status: 'connected',
    quota: { used: 0, total: 0 },
    host: '140.238.0.1',
    port: 22,
    username: 'sanjay',
  },
]

const connectionsPageData: MockConnection[] = [
  {
    id: 'conn-google',
    remoteId: 'conn-google',
    provider: 'google',
    accountKey: 'google-1',
    accountEmail: 'google@example.com',
    accountLabel: 'Google Drive',
    accountName: 'Google Drive',
    status: 'connected',
  },
  {
    id: 'conn-dropbox',
    remoteId: 'conn-dropbox',
    provider: 'dropbox',
    accountKey: 'dropbox-1',
    accountEmail: 'dropbox@example.com',
    accountLabel: 'Dropbox Team',
    accountName: 'Dropbox Team',
    status: 'connected',
  },
  {
    id: 'conn-box',
    remoteId: 'conn-box',
    provider: 'box',
    accountKey: 'box-1',
    accountEmail: 'ops@box.example.com',
    accountLabel: 'Box Ops',
    accountName: 'Box Ops',
    status: 'error',
  },
  {
    id: 'conn-vps',
    remoteId: 'conn-vps',
    provider: 'vps',
    accountKey: 'vps-oci',
    accountEmail: '',
    accountLabel: 'OCI',
    accountName: 'OCI',
    status: 'connected',
    host: '140.238.0.1',
    port: 22,
    username: 'sanjay',
  },
]

test.beforeAll(async () => {
  await ensureShotDir()
})

test('captures login layout centered with matched card bottoms', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/?mode=login')
  await expect(page.getByRole('heading', { name: 'Enter the control plane.' })).toBeVisible()

  const grid = page.locator('.cf-shell-page > .grid').first()
  const hero = grid.locator('section').nth(0)
  const form = grid.locator('section').nth(1)
  const gridBox = await box(grid)
  const heroBox = await box(hero)
  const formBox = await box(form)
  const viewportHeight = page.viewportSize()?.height || 1100
  const topGap = gridBox.y
  const bottomGap = viewportHeight - (gridBox.y + gridBox.height)

  expect(Math.abs(topGap - bottomGap)).toBeLessThan(120)
  expect(Math.abs(heroBox.y + heroBox.height - (formBox.y + formBox.height))).toBeLessThan(3)

  await page.screenshot({ path: shotPath('dispatch1_login_desktop'), fullPage: true })
})

test('captures dashboard status row with proportional card widths and aligned bottoms', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedAuthRuntime(page, request, dashboardConnections)
  await page.goto('/dashboard')
  await expect(page.getByTestId('cf-mission-control')).toBeVisible({ timeout: 15000 })

  const cards = page.locator('[data-testid="cf-mission-control"] > div > div')
  const left = await box(cards.nth(0))
  const middle = await box(cards.nth(1))
  const right = await box(cards.nth(2))

  expect(Math.abs(left.y + left.height - (middle.y + middle.height))).toBeLessThan(3)
  expect(Math.abs(right.y + right.height - (middle.y + middle.height))).toBeLessThan(3)
  expect(middle.width / left.width).toBeGreaterThan(1.7)
  expect(middle.width / left.width).toBeLessThan(2.3)
  expect(right.width / left.width).toBeGreaterThan(1.05)
  expect(right.width / left.width).toBeLessThan(1.4)

  await page.screenshot({ path: shotPath('dispatch1_dashboard_status_desktop'), fullPage: true })
})

test('captures connections page in a two-column card grid', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedAuthRuntime(page, request, connectionsPageData)
  await page.goto('/connections')
  await expect(page.getByTestId('cf-connections-list')).toBeVisible({ timeout: 15000 })

  const cards = page.locator('[data-testid^="cf-connection-item-"]')
  const first = await box(cards.nth(0))
  const second = await box(cards.nth(1))
  const third = await box(cards.nth(2))

  expect(Math.abs(first.y - second.y)).toBeLessThan(3)
  expect(third.y).toBeGreaterThan(first.y + 20)

  await page.screenshot({ path: shotPath('dispatch1_connections_desktop'), fullPage: true })
})

test('captures files desktop sidebar with neutral VPS quota placeholders', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedAuthRuntime(page, request, dashboardConnections)
  await page.goto('/files')
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('No usage data').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('0 B · 0%', { exact: true })).toHaveCount(0)

  await page.screenshot({ path: shotPath('dispatch1_files_sidebar_desktop'), fullPage: true })
})

test('captures files mobile toolbar without section labels and with expandable search', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedAuthRuntime(page, request, dashboardConnections)
  await page.goto('/files')
  await expect(page.getByRole('button', { name: 'Open search' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Views', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Search', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Actions', { exact: true })).toHaveCount(0)

  await page.screenshot({ path: shotPath('dispatch1_files_toolbar_mobile'), fullPage: true })

  await page.getByRole('button', { name: 'Open search' }).click()
  await expect(page.getByTestId('cf-global-search-input')).toBeVisible()
})

test('captures provider integration cards with aligned heights and button baselines', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await seedAuthRuntime(page, request, dashboardConnections)
  await page.goto('/providers')
  await expect(page.getByRole('heading', { name: 'Available Integrations' })).toBeVisible({ timeout: 15000 })

  const googleCard = page.getByTestId('cf-provider-connect-card-google')
  const onedriveCard = page.getByTestId('cf-provider-connect-card-onedrive')
  const dropboxCard = page.getByTestId('cf-provider-connect-card-dropbox')

  await googleCard.scrollIntoViewIfNeeded()

  const googleBox = await box(googleCard)
  const onedriveBox = await box(onedriveCard)
  const dropboxBox = await box(dropboxCard)
  const googleButton = await box(googleCard.getByRole('button', { name: 'Connect' }))
  const onedriveButton = await box(onedriveCard.getByRole('button', { name: 'Connect' }))
  const dropboxButton = await box(dropboxCard.getByRole('button', { name: 'Connect' }))

  expect(Math.abs(googleBox.height - onedriveBox.height)).toBeLessThan(3)
  expect(Math.abs(googleBox.height - dropboxBox.height)).toBeLessThan(3)
  expect(Math.abs((googleButton.y + googleButton.height) - (onedriveButton.y + onedriveButton.height))).toBeLessThan(3)
  expect(Math.abs((googleButton.y + googleButton.height) - (dropboxButton.y + dropboxButton.height))).toBeLessThan(3)

  await page.screenshot({ path: shotPath('dispatch1_providers_integrations_desktop'), fullPage: true })
})
