import fs from 'node:fs'
import { test, expect, Page } from '@playwright/test'

type VpsNode = {
  label: string
  host: string
  port: number
  username: string
  pemPath: string
}

function loadVpsNodes(): VpsNode[] {
  const isValidNode = (node: Partial<VpsNode>): node is VpsNode => {
    return Boolean(
      node?.label &&
      node?.host &&
      Number.isFinite(node?.port) &&
      node?.username &&
      node?.pemPath
    )
  }

  try {
    // Keep fixture optional so the suite can still run from env-only CI setups.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixture = require('../../fixtures/vps-test-config') as { VPS_NODES?: VpsNode[] }
    if (Array.isArray(fixture?.VPS_NODES) && fixture.VPS_NODES.length > 0) {
      return fixture.VPS_NODES.filter(isValidNode)
    }
  } catch {
    // fall through to env-based defaults
  }

  return [
    {
      label: 'OCI Node',
      host: process.env.VPS1_HOST || '',
      port: 22,
      username: process.env.VPS1_USER || '',
      pemPath: process.env.VPS1_PEM_PATH || '',
    },
    {
      label: 'India Node',
      host: process.env.VPS2_HOST || '',
      port: 22,
      username: process.env.VPS2_USER || '',
      pemPath: process.env.VPS2_PEM_PATH || '',
    },
  ].filter(isValidNode)
}

const VPS_NODES = loadVpsNodes()
const MISSING_VPS_CONFIG_REASON =
  'Set VPS1/VPS2 env vars (or e2e/fixtures/vps-test-config.ts) for live VPS tests'
const NODES_UNDER_TEST: VpsNode[] =
  VPS_NODES.length > 0
    ? VPS_NODES
    : [{ label: 'Missing VPS Config', host: '', port: 22, username: '', pemPath: '' }]
const QA_EMAIL = process.env.PLAYWRIGHT_QA_EMAIL || 'admin@cacheflow.goels.in'
const QA_PASSWORD = process.env.PLAYWRIGHT_QA_PASSWORD || 'admin123'

function maskedHost(host: string): string {
  const ipv4 = host.match(/^(\d+\.\d+\.\d+)\.\d+$/)
  if (ipv4) return `${ipv4[1]}.●●●`
  if (!host) return '●●●'
  const dotIndex = host.lastIndexOf('.')
  if (dotIndex <= 0) return '●●●'
  return `${host.slice(0, dotIndex)}.●●●`
}

function cardByLabel(page: Page, label: string) {
  return page.locator('div[data-testid^="cf-provider-card-"]').filter({ hasText: label }).first()
}

async function login(page: Page) {
  const emailInput = page
    .locator(
      'input[placeholder*="email" i], input[type="email"], input[name*="email" i], input[id*="email" i]',
    )
    .first()
  const passwordInput = page
    .locator(
      'input[placeholder*="password" i], input[type="password"], input[name*="password" i], input[id*="password" i]',
    )
    .first()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(emailInput).toBeVisible({ timeout: 20_000 })
  await expect(passwordInput).toBeVisible({ timeout: 20_000 })
  await emailInput.fill(QA_EMAIL)
  await passwordInput.fill(QA_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {})
  await page.waitForURL(/\/files|\/providers|\/remotes|\/connections|\/$/, { timeout: 20_000 }).catch(() => {})

  const hasSession = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) return false
      const payload = await response.json().catch(() => ({}))
      return Boolean(payload?.authenticated)
    } catch {
      return false
    }
  })

  if (hasSession) return

  const fallback = await page.request.post('/api/auth/login', {
    data: { email: QA_EMAIL, password: QA_PASSWORD },
    failOnStatusCode: false,
  })
  if (!fallback.ok()) {
    throw new Error(`Login failed (${fallback.status()}) for ${QA_EMAIL}`)
  }
}

async function openProviders(page: Page) {
  await page.goto('/providers', { waitUntil: 'domcontentloaded' })
  if (page.url().includes('/login')) {
    await login(page)
    await page.goto('/providers', { waitUntil: 'domcontentloaded' })
  }
  await expect(page).toHaveURL(/\/providers/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Provider Connections/i })).toBeVisible({ timeout: 30_000 })
}

async function openVpsModal(page: Page) {
  const connectCard = page.getByTestId('cf-provider-connect-card-vps')
  await expect(connectCard).toBeVisible({ timeout: 20_000 })
  await connectCard.getByRole('button', { name: /connect/i }).click()
  await expect(page.getByRole('heading', { name: 'Connect VPS / SFTP' })).toBeVisible({ timeout: 10_000 })
}

async function connectNode(page: Page, node: VpsNode, label: string, port = node.port) {
  await openVpsModal(page)
  const modal = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: 'Connect VPS / SFTP' }),
  })

  await modal.getByPlaceholder('OCI Node 1').fill(label)
  await modal.getByPlaceholder('203.0.113.1').fill(node.host)
  await modal.locator('input[type="number"]').first().fill(String(port))
  await modal.getByPlaceholder('username').fill(node.username)
  await modal.locator('input[type="file"]').setInputFiles(node.pemPath)

  await modal.getByRole('button', { name: 'Test & Connect' }).click()
}

async function disconnectProvider(page: Page, label: string) {
  const card = cardByLabel(page, label)
  if (!(await card.isVisible().catch(() => false))) return

  await card.getByRole('button', { name: /^Disconnect$/i }).click()
  const confirm = page.getByRole('button', { name: /^Disconnect$/i }).last()
  await confirm.click()
  await expect(card).not.toBeVisible({ timeout: 30_000 })
}

async function setVpsUploadFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer } | string,
) {
  const main = page.locator('main').first()
  const fileInput = main.locator('input[type="file"]').first()
  await fileInput.setInputFiles(file)
  await expect(main.getByRole('button', { name: /^Upload$/i })).toBeEnabled({ timeout: 10_000 })
}

async function openTmpDirectory(page: Page) {
  const tmpRow = page
    .locator('tbody tr')
    .filter({ has: page.getByRole('button', { name: /^tmp$/i }) })
    .first()
  const tmpButton = tmpRow.getByRole('button', { name: /^tmp$/i })
  await expect(tmpButton).toBeVisible({ timeout: 30_000 })
  await tmpButton.click({ force: true })
  await expect(page.getByText(/Path:\s*\/tmp/)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('tbody tr').filter({ hasText: 'Loading...' })).toHaveCount(0, { timeout: 120_000 })
}

async function cleanupDownloadedFile(row: ReturnType<Page['getByRole']>, fileName: string, nodeLabel: string) {
  await row.getByRole('button', { name: /Delete/i }).click()

  try {
    await expect(row).toHaveCount(0, { timeout: 20_000 })
  } catch {
    // Download validation is the primary assertion here. Deletion is covered by the dedicated delete test.
    console.warn(`[VPS E2E] Cleanup delete for ${fileName} on ${nodeLabel} did not complete within timeout`)
  }
}

test.describe('VPS SFTP provider — live node tests', () => {
  for (const node of NODES_UNDER_TEST) {
    test.describe(node.label, () => {
      test.beforeEach(async ({ page }) => {
        test.skip(VPS_NODES.length === 0, MISSING_VPS_CONFIG_REASON)
        test.setTimeout(180_000)
        await login(page)
        await openProviders(page)
      })

      test('Connect via UI', async ({ page }) => {
        const label = `${node.label} Connect ${Date.now()}`
        await connectNode(page, node, label)

        const card = cardByLabel(page, label)
        await expect(card).toBeVisible({ timeout: 45_000 })
        await expect(card).toContainText(maskedHost(node.host))
        await expect(card).toContainText(`SFTP · :${node.port}`)
        await expect(page.getByText(/Connection test failed/i)).toHaveCount(0)

        await disconnectProvider(page, label)
      })

      test('Browse root directory', async ({ page }) => {
        const label = `${node.label} Browse ${Date.now()}`
        await connectNode(page, node, label)

        const card = cardByLabel(page, label)
        await expect(card).toBeVisible({ timeout: 45_000 })
        await card.getByRole('button', { name: /Open Files/i }).click()

        await expect(page).toHaveURL(/\/providers\/vps\//, { timeout: 20_000 })
        await expect(page.locator('thead')).toContainText('Name')
        await expect(page.locator('thead')).toContainText('Type')
        await expect(page.locator('thead')).toContainText('Size')

        const firstRow = page.locator('tbody tr').first()
        await expect(firstRow).toBeVisible({ timeout: 30_000 })
        await expect(firstRow).not.toContainText('Empty directory')

        await page.getByRole('button', { name: /Back to Providers/i }).click()
        await disconnectProvider(page, label)
      })

      test('Upload test file', async ({ page }) => {
        const label = `${node.label} Upload ${Date.now()}`
        const fileName = `cacheflow-e2e-test-${Date.now()}.txt`
        const content = 'cacheflow e2e test'

        await connectNode(page, node, label)
        const card = cardByLabel(page, label)
        await expect(card).toBeVisible({ timeout: 45_000 })
        await card.getByRole('button', { name: /Open Files/i }).click()

        await openTmpDirectory(page)

        await setVpsUploadFile(page, {
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from(content, 'utf8'),
        })
        await page.getByRole('button', { name: /^Upload$/i }).click()
        await expect(page.getByRole('row').filter({ hasText: fileName })).toBeVisible({ timeout: 90_000 })

        await page.getByRole('button', { name: /Back to Providers/i }).click()
        await disconnectProvider(page, label)
      })

      test('Download test file', async ({ page }) => {
        const label = `${node.label} Download ${Date.now()}`
        const fileName = `cacheflow-e2e-test-${Date.now()}.txt`
        const content = 'cacheflow e2e test'

        await connectNode(page, node, label)
        const card = cardByLabel(page, label)
        await expect(card).toBeVisible({ timeout: 45_000 })
        await card.getByRole('button', { name: /Open Files/i }).click()

        await openTmpDirectory(page)

        await setVpsUploadFile(page, {
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from(content, 'utf8'),
        })
        await page.getByRole('button', { name: /^Upload$/i }).click()

        const row = page.getByRole('row').filter({ hasText: fileName })
        await expect(row).toBeVisible({ timeout: 90_000 })

        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 20_000 }),
          row.getByRole('link', { name: /Download/i }).click(),
        ])

        const downloadPath = await download.path()
        expect(downloadPath).toBeTruthy()
        const downloaded = fs.readFileSync(downloadPath as string, 'utf8')
        expect(downloaded).toBe(content)

        await cleanupDownloadedFile(row, fileName, node.label)

        await page.getByRole('button', { name: /Back to Providers/i }).click()
        await disconnectProvider(page, label)
      })

      test('Delete test file', async ({ page }) => {
        const label = `${node.label} Delete ${Date.now()}`
        const fileName = `cacheflow-e2e-test-${Date.now()}.txt`

        await connectNode(page, node, label)
        const card = cardByLabel(page, label)
        await expect(card).toBeVisible({ timeout: 45_000 })
        await card.getByRole('button', { name: /Open Files/i }).click()

        await openTmpDirectory(page)

        await setVpsUploadFile(page, {
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from('cacheflow e2e test', 'utf8'),
        })
        await page.getByRole('button', { name: /^Upload$/i }).click()

        const row = page.getByRole('row').filter({ hasText: fileName })
        await expect(row).toBeVisible({ timeout: 90_000 })
        await row.getByRole('button', { name: /Delete/i }).click()
        await expect(row).toHaveCount(0)

        await page.getByRole('button', { name: /Back to Providers/i }).click()
        await disconnectProvider(page, label)
      })

      test('Disconnect provider', async ({ page }) => {
        const label = `${node.label} Disconnect ${Date.now()}`

        await connectNode(page, node, label)
        const card = cardByLabel(page, label)
        await expect(card).toBeVisible({ timeout: 45_000 })

        await card.getByRole('button', { name: /^Disconnect$/i }).click()
        const responsePromise = page.waitForResponse(
          (response) => {
            const req = response.request()
            return req.method() === 'DELETE' && /\/api\/providers\/vps\//.test(req.url())
          },
          { timeout: 20_000 },
        )

        await page.getByRole('button', { name: /^Disconnect$/i }).last().click()
        const response = await responsePromise
        expect(response.ok()).toBeTruthy()
        await expect(card).toHaveCount(0)
      })

      test('Connection failure handling', async ({ page }) => {
        const label = `${node.label} Bad Port ${Date.now()}`

        await connectNode(page, node, label, 2222)

        await expect(page.getByRole('heading', { name: 'Connect VPS / SFTP' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(/Connection test failed|connect failed|timed out|ECONNREFUSED/i)).toBeVisible({ timeout: 30_000 })
        await expect(cardByLabel(page, label)).toHaveCount(0)
      })
    })
  }
})
