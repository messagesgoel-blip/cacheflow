import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  gotoFilesAndWait,
  installMockRuntime,
  primeQaSession,
  type MockConnection,
  type MockProxyRequest,
} from './helpers/mockRuntime'

type DispatchConnection = MockConnection & {
  status?: 'connected' | 'disconnected' | 'error'
  host?: string
  port?: number
  username?: string
  lastSyncAt?: string
}

const QA_EMAIL = process.env.PLAYWRIGHT_QA_EMAIL || 'layout@cacheflow.test'
const QA_PASSWORD = process.env.PLAYWRIGHT_QA_PASSWORD || '123password'

const connections: DispatchConnection[] = [
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

function quotaBytes(gb: number): number {
  return gb * 1024 * 1024 * 1024
}

function proxyHandler({ remoteId, url }: MockProxyRequest) {
  if (remoteId === 'remote-google-1' && url.includes('about?fields=storageQuota')) {
    return {
      json: {
        storageQuota: {
          usage: String(quotaBytes(48)),
          limit: String(quotaBytes(100)),
        },
      },
    }
  }

  if (remoteId === 'remote-dropbox-1' && url.includes('/users/get_space_usage')) {
    return {
      json: {
        allocation: { allocated: quotaBytes(20) },
        used: quotaBytes(12),
      },
    }
  }

  if (remoteId === 'remote-google-1' && url.includes('/drive/v3/files') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
    return {
      json: {
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
      },
    }
  }

  if (remoteId === 'remote-dropbox-1' && url.includes('/files/list_folder')) {
    return {
      json: {
        entries: [],
        has_more: false,
        cursor: 'mock-cursor',
      },
    }
  }

  if (remoteId === 'remote-vps-oci' && url.includes('/folders/0/items')) {
    return {
      json: {
        entries: [],
        total_count: 0,
      },
    }
  }

  return undefined
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: theme })
  await page.addInitScript((selectedTheme: 'light' | 'dark') => {
    localStorage.setItem('cf_theme', selectedTheme)
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(selectedTheme)
  }, theme)
}

async function installDispatchRoutes(page: Page) {
  await page.route('**/api/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
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

  await page.route('**/api/providers/vps/*/files?path=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: [] }),
    })
  })
}

async function bootAuthedSurface(page: Page, request: any, theme: 'light' | 'dark') {
  await primeQaSession(page, request, QA_EMAIL, QA_PASSWORD)
  await setTheme(page, theme)
  await installMockRuntime(page, connections, proxyHandler, {
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
  })
  await installDispatchRoutes(page)
  await gotoFilesAndWait(page)
}

async function expectSnapshot(locator: Locator, name: string) {
  await expect(locator).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
  })
}

async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function expectLoginLayout(page: Page) {
  const grid = page.locator('.cf-shell-page .grid').first()
  const hero = grid.locator('section').filter({ hasText: /One control plane/i }).first()
  const form = grid.locator('section').filter({ has: page.getByTestId('email-input') }).first()
  const viewportHeight = page.viewportSize()?.height || 960
  const gridBox = await grid.boundingBox()
  const heroBox = await hero.boundingBox()
  const formBox = await form.boundingBox()

  expect(gridBox).not.toBeNull()
  expect(heroBox).not.toBeNull()
  expect(formBox).not.toBeNull()

  const topGap = gridBox!.y
  const bottomGap = viewportHeight - (gridBox!.y + gridBox!.height)

  expect(Math.abs(topGap - bottomGap)).toBeLessThan(120)
  expect(Math.abs(heroBox!.y + heroBox!.height - (formBox!.y + formBox!.height))).toBeLessThan(5)
}

async function expectConnectionsLayout(page: Page) {
  const list = page.getByTestId('cf-connections-list')
  await expect(list).toBeVisible({ timeout: 15_000 })
  
  const cards = page.locator('[data-testid^="cf-connection-item-"]')
  // Wait for at least one card to be visible instead of a hard timeout (SPEC-10)
  await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  
  const count = await cards.count()
  if (count >= 2) {
    const box1 = await cards.nth(0).boundingBox()
    const box2 = await cards.nth(1).boundingBox()
    
    expect(box1).not.toBeNull()
    expect(box2).not.toBeNull()
    
    // On desktop, cards should be in a 2-column grid with matching heights (SPEC-10)
    if (page.viewportSize()!.width > 768) {
      expect(Math.abs(box1!.y - box2!.y)).toBeLessThan(5)
      expect(Math.abs(box1!.height - box2!.height)).toBeLessThan(5)
    }
  }
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test('login page stays vertically centered with matched card heights', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop-only login layout capture')

      await page.setViewportSize({ width: 1440, height: 900 })
      await setTheme(page, theme)
      await page.goto('/?mode=login')
      await expect(page.getByRole('heading', { name: /Enter the control plane/i })).toBeVisible()
      await expectLoginLayout(page)
      await expectSnapshot(page.locator('.cf-shell-page').first(), `dispatch2-login-desktop-${theme}.png`)
    })

    test('connections page cards align in grid with stable dimensions', async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop-only connections layout check')

      await bootAuthedSurface(page, request, theme)
      await page.goto('/connections')
      await expectConnectionsLayout(page)
      await expectSnapshot(page.locator('.cf-shell-page').first(), `dispatch2-connections-desktop-${theme}.png`)
    })

    test('MissionControl mobile status cards collapse into a horizontal strip', async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile-only MissionControl capture')

      await bootAuthedSurface(page, request, theme)
      await page.goto('/dashboard')
      const strip = page.getByTestId('cf-mission-control-mobile-strip')
      await expect(strip).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('cf-mission-control-mobile-item-control-plane')).toBeVisible()
      await expectSnapshot(strip, `dispatch2-missioncontrol-mobile-${theme}.png`)
    })

    test('files loading panel keeps workspace meta on desktop', async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop-only loading panel capture')

      await bootAuthedSurface(page, request, theme)
      await page.route('**/api/remotes/*/proxy', async (route) => {
        await delay(2_000)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [], nextPageToken: null }),
        })
      })

      await page.goto('/files')
      const workspace = page.getByText('Loading files...')
      await expect(workspace).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('cf-loading-workspace-meta')).toBeVisible()
      await expectSnapshot(page.locator('[data-testid="cf-loading-workspace-meta"]').first(), `dispatch2-files-loading-desktop-${theme}.png`)
    })

    test('files loading panel hides workspace meta on mobile', async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile-only loading panel capture')

      await bootAuthedSurface(page, request, theme)
      await page.route('**/api/remotes/*/proxy', async (route) => {
        await delay(2_000)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [], nextPageToken: null }),
        })
      })

      await page.goto('/files')
      await expect(page.getByText('Loading files...')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('cf-loading-workspace-meta')).toHaveCount(0)
      await expectSnapshot(page.locator('main').first(), `dispatch2-files-loading-mobile-${theme}.png`)
    })

    test('providers navbar stays sticky above content', async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop-only providers capture')

      await bootAuthedSurface(page, request, theme)
      await page.goto('/providers')
      const navbar = page.getByRole('navigation').filter({ hasText: /CacheFlow/i }).first()
      const contentHeading = page.getByRole('heading', { name: 'Available Integrations' })

      await expect(navbar).toBeVisible({ timeout: 15_000 })
      await expect(contentHeading).toBeVisible({ timeout: 15_000 })

      await page.evaluate(() => window.scrollTo(0, 600))
      const navbarBox = await navbar.boundingBox()
      const headingBox = await contentHeading.boundingBox()

      expect(navbarBox).not.toBeNull()
      expect(headingBox).not.toBeNull()
      expect(navbarBox!.y).toBeLessThanOrEqual(1)
      expect(headingBox!.y).toBeGreaterThan(navbarBox!.y + navbarBox!.height - 5)

      await expectSnapshot(page.locator('.cf-shell-page').first(), `dispatch2-providers-sticky-desktop-${theme}.png`)
    })
  })
}

test('mobile files breadcrumb hides the navigation path label', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile-only breadcrumb capture')

  await bootAuthedSurface(page, request, 'light')
  await expect(page.getByTestId('cf-breadcrumb')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Navigation Path', { exact: true })).toHaveCount(0)
  await expectSnapshot(page.getByTestId('cf-breadcrumb'), 'dispatch2-mobile-breadcrumb-light.png')
})
