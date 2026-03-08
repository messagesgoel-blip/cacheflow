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
const SAVED_VPS_SOURCE_LABEL = process.env.PLAYWRIGHT_VPS_SOURCE_LABEL || 'OCI'
const SAVED_VPS_TARGET_LABEL = process.env.PLAYWRIGHT_VPS_TARGET_LABEL || 'test remote'
const MOCK_RUN_PATH = '/srv/storage/local/mock run'
const MOCK_RUN_ARCHIVE_PATH = `${MOCK_RUN_PATH}/archive`
const SAVED_VPS_SOURCE_ID = '03f733ac-68dd-4f6b-83ee-0fca06a8888a'
const SAVED_VPS_TARGET_ID = '0e57f4e0-3964-4757-afcd-5286faf294e2'
const QA_ARTIFACT_PATTERN = /^pw[-_]/

type VpsDirectoryEntry = {
  name: string
  type: 'dir' | 'file'
}

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
  await expect(
    page.getByRole('heading', { name: /Connected Providers|Provider Connections/i }),
  ).toBeVisible({ timeout: 30_000 })
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
  await modal.getByRole('button', { name: 'Test Connection' }).click()

  if (port === node.port) {
    await expect(modal.getByText(/Connection successful/i)).toBeVisible({ timeout: 30_000 })
    await expect(modal.getByText(/Host Fingerprint/i)).toBeVisible({ timeout: 30_000 })
    await modal.getByRole('button', { name: 'Save VPS' }).click()
  }
}

async function disconnectProvider(page: Page, label: string) {
  const card = cardByLabel(page, label)
  if (!(await card.isVisible().catch(() => false))) return

  await card.getByRole('button', { name: /^Disconnect$/i }).click()
  const confirm = page.getByRole('button', { name: /^Disconnect$/i }).last()
  await confirm.click()
  await expect(card).not.toBeVisible({ timeout: 30_000 })
}

async function openSavedVpsBrowser(page: Page, label: string) {
  await openProviders(page)
  const card = cardByLabel(page, label)
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.getByRole('button', { name: /Open Files/i }).click()
  await expect(page).toHaveURL(/\/providers\/vps\//, { timeout: 20_000 })
}

async function editSavedVpsLabel(page: Page, currentLabel: string, nextLabel: string) {
  await openProviders(page)
  const card = cardByLabel(page, currentLabel)
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.getByRole('button', { name: /Edit Details/i }).click()

  const modal = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: 'Edit VPS / SFTP' }),
  })
  await expect(modal).toBeVisible({ timeout: 10_000 })

  const labelInput = modal.getByPlaceholder('OCI Node 1')
  await labelInput.fill(nextLabel)
  await modal.getByRole('button', { name: /Save Changes/i }).click()
  await expect(modal).toHaveCount(0, { timeout: 30_000 })
  await expect(cardByLabel(page, nextLabel)).toBeVisible({ timeout: 30_000 })
}

async function openMockRunInVpsBrowser(page: Page) {
  await page.getByRole('button', { name: /^Mock Run$/i }).click()
  await expect(page.getByText(`Path: ${MOCK_RUN_PATH}`)).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('tbody tr').filter({ hasText: 'Loading...' })).toHaveCount(0, { timeout: 120_000 })
}

async function openFolderInVpsBrowser(page: Page, folderName: string, expectedPath: string) {
  const folderButton = page
    .locator('tbody tr')
    .filter({ has: page.getByRole('button', { name: new RegExp(`^${folderName}$`) }) })
    .first()
    .getByRole('button', { name: new RegExp(`^${folderName}$`) })
  await expect(folderButton).toBeVisible({ timeout: 30_000 })
  await folderButton.click({ force: true })
  await expect(page.getByText(`Path: ${expectedPath}`)).toBeVisible({ timeout: 30_000 })
}

async function uploadFileToCurrentVpsPath(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await setVpsUploadFile(page, file)
  await page.getByRole('button', { name: /^Upload$/i }).click()
  await expect(page.getByRole('row').filter({ hasText: file.name })).toBeVisible({ timeout: 90_000 })
}

async function deleteFileFromCurrentVpsPath(page: Page, fileName: string) {
  const row = page.getByRole('row').filter({ hasText: fileName })
  if (!(await row.isVisible().catch(() => false))) return
  await row.getByRole('button', { name: /Delete/i }).click()
  await expect(row).toHaveCount(0, { timeout: 90_000 })
}

async function goToFiles(page: Page) {
  await page.goto('/files', { waitUntil: 'domcontentloaded' })
  if (page.url().includes('/login')) {
    await login(page)
    await page.goto('/files', { waitUntil: 'domcontentloaded' })
  }
  await expect(page).toHaveURL(/\/files/, { timeout: 30_000 })
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 30_000 })
}

async function selectSidebarAccount(page: Page, label: string) {
  const account = page
    .locator('[data-testid^="cf-sidebar-account-"]')
    .filter({ hasText: label })
    .first()
  await expect(account).toBeVisible({ timeout: 30_000 })
  await account.click()
  await expect(page.getByTestId('cf-breadcrumb')).toContainText(`VPS / SFTP (${label})`, { timeout: 30_000 })
  await expect(page.getByText('Loading files...')).toHaveCount(0, { timeout: 90_000 })
}

async function waitForUnifiedBrowserIdle(page: Page) {
  await expect(page.getByText('Loading files...')).toHaveCount(0, { timeout: 90_000 })
}

async function refreshUnifiedBrowser(page: Page) {
  await page.getByTestId('files-refresh').click()
  await waitForUnifiedBrowserIdle(page)
}

async function waitForFolderRow(page: Page, folderName: string, timeout = 60_000) {
  const row = page
    .locator(`[data-testid="cf-file-row"][data-file-name="${folderName}"]`)
    .first()
  await expect(row).toBeVisible({ timeout })
  return row
}

async function openFolderInUnifiedBrowser(page: Page, folderName: string) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await waitForUnifiedBrowserIdle(page)
      const row = await waitForFolderRow(page, folderName, attempt === 1 ? 60_000 : 90_000)
      await row.click()
      await expect(page.getByTestId('cf-breadcrumb')).toContainText(folderName, { timeout: 90_000 })
      await waitForUnifiedBrowserIdle(page)
      return
    } catch (error) {
      lastError = error
      if (attempt === 2) break
      await refreshUnifiedBrowser(page)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to open folder ${folderName}`)
}

async function ensureFolderOpenInUnifiedBrowser(page: Page, folderName: string) {
  await waitForUnifiedBrowserIdle(page)
  const breadcrumbText = (await page.getByTestId('cf-breadcrumb').textContent()) || ''
  if (breadcrumbText.includes(folderName)) return
  await openFolderInUnifiedBrowser(page, folderName)
}

async function expectUnifiedBrowserFile(page: Page, fileName: string) {
  await expect(
    page.locator('[data-testid="cf-file-row"]').filter({ hasText: fileName }).first(),
  ).toBeVisible({ timeout: 90_000 })
}

async function expectUnifiedBrowserFileMissing(page: Page, fileName: string) {
  await expect(
    page.locator('[data-testid="cf-file-row"]').filter({ hasText: fileName }),
  ).toHaveCount(0, { timeout: 90_000 })
}

async function selectFileInUnifiedBrowser(page: Page, fileName: string) {
  const row = page
    .locator('[data-testid="cf-file-row"]')
    .filter({ hasText: fileName })
    .first()
  await expect(row).toBeVisible({ timeout: 60_000 })
  await row.getByTestId('cf-row-checkbox').check()
  await expect(page.getByTestId('cf-selection-toolbar')).toBeVisible({ timeout: 30_000 })
}

async function openSelectionToolbarAction(page: Page, actionName: 'Copy' | 'Move') {
  const button = page
    .getByTestId('cf-selection-toolbar')
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${actionName}$`, 'i') })
    .first()
  await expect(button).toBeVisible({ timeout: 30_000 })
  await button.click()
}

async function deleteSelectedFileInUnifiedBrowser(page: Page) {
  const toolbar = page.getByTestId('cf-selection-toolbar')
  await expect(toolbar).toBeVisible({ timeout: 30_000 })
  await toolbar.getByRole('button', { name: /^Delete$/i }).click()
  await page.getByRole('button', { name: /^Delete$/i }).last().click()
}

async function waitForTransferState(page: Page, state: 'COMPLETED' | 'FAILED') {
  const panel = page.getByTestId('cf-transfer-queue-panel')
  await expect(panel).toBeVisible({ timeout: 30_000 })
  const item = panel.locator('[data-testid^="cf-transfer-queue-item-"]').last()
  await expect(item.getByText(state)).toBeVisible({ timeout: 120_000 })
  return item
}

async function openMockRunInUnifiedBrowser(page: Page) {
  for (const segment of ['srv', 'storage', 'local', 'mock run']) {
    await openFolderInUnifiedBrowser(page, segment)
  }
  await expect(page.getByTestId('cf-breadcrumb')).toContainText('mock run', { timeout: 30_000 })
  await refreshUnifiedBrowser(page)
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

async function uploadFileToUnifiedBrowser(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  const main = page.locator('main').first()
  const fileInput = main.locator('input[type="file"]').first()
  await fileInput.setInputFiles(file)
  await expectUnifiedBrowserFile(page, file.name)
}

async function createFolderInUnifiedBrowser(page: Page, folderName: string) {
  await page.getByTestId('cf-action-new-folder').click()
  await page.getByTestId('cf-new-folder-name').fill(folderName)
  await page.getByTestId('cf-create-folder-submit').click()
  await expectUnifiedBrowserFile(page, folderName)
}

async function createStarterFileInUnifiedBrowser(
  page: Page,
  baseName: string,
  template: 'txt' | 'md' | 'json' | 'csv' | 'html' | 'js' | 'ts' | 'tsx' | 'css' | 'xml',
) {
  const extensionMap: Record<typeof template, string> = {
    txt: '.txt',
    md: '.md',
    json: '.json',
    csv: '.csv',
    html: '.html',
    js: '.js',
    ts: '.ts',
    tsx: '.tsx',
    css: '.css',
    xml: '.xml',
  }
  const fileName = `${baseName}${extensionMap[template]}`

  await page.getByTestId('cf-action-new-file').click()
  await page.getByTestId('cf-new-file-name').fill(baseName)
  await page.getByTestId('cf-new-file-template').selectOption(template)
  await page.getByTestId('cf-create-file-submit').click()
  await expectUnifiedBrowserFile(page, fileName)

  return fileName
}

async function openRowOverflow(page: Page, rowName: string) {
  const row = page
    .locator('[data-testid="cf-file-row"]')
    .filter({ hasText: rowName })
    .first()
  await expect(row).toBeVisible({ timeout: 60_000 })
  await row.getByTestId('cf-files-row-overflow').click()
  return row
}

function buildVpsFilesApiPath(connectionId: string, remotePath: string) {
  return `/api/providers/vps/${encodeURIComponent(connectionId)}/files?path=${encodeURIComponent(remotePath)}`
}

async function listVpsDirectoryViaApi(
  page: Page,
  connectionId: string,
  remotePath: string,
): Promise<VpsDirectoryEntry[]> {
  const response = await page.request.get(buildVpsFilesApiPath(connectionId, remotePath), {
    failOnStatusCode: false,
  })
  expect(response.ok(), `Expected to list ${remotePath} via VPS API`).toBeTruthy()
  return (await response.json()) as VpsDirectoryEntry[]
}

async function deleteVpsPathViaApi(page: Page, connectionId: string, remotePath: string) {
  const response = await page.request.delete(buildVpsFilesApiPath(connectionId, remotePath), {
    failOnStatusCode: false,
  })

  if (response.ok()) return

  const payload = await response.json().catch(() => ({}))
  const detail = [payload?.error, payload?.detail].filter(Boolean).join(' ')
  if (response.status() === 404 || /no such file|not found/i.test(detail)) {
    return
  }

  throw new Error(`Failed to delete ${remotePath} via VPS API (${response.status()}): ${detail || 'unknown error'}`)
}

async function cleanupPwArtifactsInDirectory(page: Page, connectionId: string, remotePath: string) {
  const initialEntries = await listVpsDirectoryViaApi(page, connectionId, remotePath)
  const artifacts = initialEntries.filter((entry) => QA_ARTIFACT_PATTERN.test(entry.name))

  for (const entry of artifacts.filter((item) => item.type === 'file')) {
    await deleteVpsPathViaApi(page, connectionId, `${remotePath}/${entry.name}`)
  }

  for (const entry of artifacts.filter((item) => item.type === 'dir')) {
    await deleteVpsPathViaApi(page, connectionId, `${remotePath}/${entry.name}`)
  }

  const remainingArtifacts = (await listVpsDirectoryViaApi(page, connectionId, remotePath))
    .filter((entry) => QA_ARTIFACT_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort()

  expect(remainingArtifacts, `Expected ${remotePath} to be free of pw-* QA artifacts`).toEqual([])
}

async function stubSavedVpsConnections(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('cacheflow_token_vps')
    localStorage.removeItem('cacheflow_tokens_vps')
  })

  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: SAVED_VPS_TARGET_ID,
            provider: 'vps',
            accountKey: SAVED_VPS_TARGET_ID,
            remoteId: SAVED_VPS_TARGET_ID,
            accountName: SAVED_VPS_TARGET_LABEL,
            accountEmail: '',
            accountLabel: SAVED_VPS_TARGET_LABEL,
            isDefault: false,
            status: 'connected',
            host: '103.174.102.129',
            port: 22,
            username: 'sanjay',
          },
          {
            id: SAVED_VPS_SOURCE_ID,
            provider: 'vps',
            accountKey: SAVED_VPS_SOURCE_ID,
            remoteId: SAVED_VPS_SOURCE_ID,
            accountName: SAVED_VPS_SOURCE_LABEL,
            accountEmail: '',
            accountLabel: SAVED_VPS_SOURCE_LABEL,
            isDefault: false,
            status: 'connected',
            host: '40.233.74.160',
            port: 22,
            username: 'sanjay',
          },
        ],
      }),
    })
  })

  await page.route('**/api/remotes/**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          status: 'connected',
          healthy: true,
        },
      }),
    })
  })
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

test.describe('VPS saved connections — mock run QA', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000)
    await login(page)
  })

  test('transfer modal stays inside mock run', async ({ page }) => {
    await stubSavedVpsConnections(page)

    await goToFiles(page)

    await selectSidebarAccount(page, SAVED_VPS_SOURCE_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await selectFileInUnifiedBrowser(page, 'readme.txt')
    await openSelectionToolbarAction(page, 'Copy')
    const copyModal = page.getByTestId('transfer-modal-content')
    await expect(copyModal).toBeVisible({ timeout: 30_000 })
    await expect(copyModal.getByTestId('transfer-dest-path')).toContainText(MOCK_RUN_PATH)
    await copyModal.getByLabel('Target account').selectOption({ label: SAVED_VPS_TARGET_LABEL })
    await expect(copyModal.getByTestId('transfer-dest-path')).toContainText(MOCK_RUN_PATH)
    await copyModal.getByRole('button', { name: /Cancel/i }).click()

    await selectSidebarAccount(page, SAVED_VPS_TARGET_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await selectFileInUnifiedBrowser(page, 'readme.txt')
    await openSelectionToolbarAction(page, 'Move')
    const moveModal = page.getByTestId('transfer-modal-content')
    await expect(moveModal).toBeVisible({ timeout: 30_000 })
    await expect(moveModal.getByTestId('transfer-dest-path')).toContainText(MOCK_RUN_PATH)
    await moveModal.getByLabel('Target account').selectOption({ label: SAVED_VPS_SOURCE_LABEL })
    await expect(moveModal.getByTestId('transfer-dest-path')).toContainText(MOCK_RUN_PATH)
    await moveModal.getByRole('button', { name: /Cancel/i }).click()
  })

  test('copy and move stay green inside mock run', async ({ page }) => {
    const fileName = `pw-vps-transfer-${Date.now()}.txt`

    await stubSavedVpsConnections(page)

    await goToFiles(page)

    await selectSidebarAccount(page, SAVED_VPS_SOURCE_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await uploadFileToUnifiedBrowser(page, {
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(`cacheflow live vps transfer ${Date.now()}`, 'utf8'),
    })

    await selectFileInUnifiedBrowser(page, fileName)
    await openSelectionToolbarAction(page, 'Copy')
    const copyModal = page.getByTestId('transfer-modal-content')
    await expect(copyModal).toBeVisible({ timeout: 30_000 })
    await copyModal.getByLabel('Target account').selectOption({ label: SAVED_VPS_TARGET_LABEL })
    await expect(copyModal.getByTestId('transfer-dest-path')).toContainText(MOCK_RUN_PATH)
    await copyModal.getByRole('button', { name: /^Copy here$/i }).click()
    await waitForTransferState(page, 'COMPLETED')

    await selectSidebarAccount(page, SAVED_VPS_TARGET_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await page.getByTestId('files-refresh').click()
    await expectUnifiedBrowserFile(page, fileName)

    await selectFileInUnifiedBrowser(page, fileName)
    await openSelectionToolbarAction(page, 'Move')
    const moveModal = page.getByTestId('transfer-modal-content')
    await expect(moveModal).toBeVisible({ timeout: 30_000 })
    await moveModal.getByLabel('Target account').selectOption({ label: SAVED_VPS_SOURCE_LABEL })
    await expect(moveModal.getByTestId('transfer-dest-path')).toContainText(MOCK_RUN_PATH)
    await moveModal.getByRole('button', { name: /^Move here$/i }).click()
    await waitForTransferState(page, 'COMPLETED')

    await selectSidebarAccount(page, SAVED_VPS_SOURCE_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await page.getByTestId('files-refresh').click()
    await expectUnifiedBrowserFile(page, fileName)

    await selectSidebarAccount(page, SAVED_VPS_TARGET_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await page.getByTestId('files-refresh').click()
    await expectUnifiedBrowserFileMissing(page, fileName)

    await selectSidebarAccount(page, SAVED_VPS_SOURCE_LABEL)
    await openMockRunInUnifiedBrowser(page)
    await page.getByTestId('files-refresh').click()
    await selectFileInUnifiedBrowser(page, fileName)
    await deleteSelectedFileInUnifiedBrowser(page)
    await expectUnifiedBrowserFileMissing(page, fileName)
  })

  test('saved VPS test connection shows fingerprint on the provider card', async ({ page }) => {
    await openProviders(page)
    const card = cardByLabel(page, SAVED_VPS_SOURCE_LABEL)
    await expect(card).toBeVisible({ timeout: 30_000 })

    await card.getByRole('button', { name: /Test Connection/i }).click()

    await expect(card.getByText(/Last Verified/i)).toBeVisible({ timeout: 30_000 })
    await expect(card.getByText(/SHA256:/i)).toBeVisible({ timeout: 30_000 })
  })

  test('editing a saved VPS label updates providers and files and then restores it', async ({ page }) => {
    const originalLabel = SAVED_VPS_SOURCE_LABEL
    const temporaryLabel = `${originalLabel} QA ${Date.now()}`

    await editSavedVpsLabel(page, originalLabel, temporaryLabel)

    await goToFiles(page)
    await selectSidebarAccount(page, temporaryLabel)

    await editSavedVpsLabel(page, temporaryLabel, originalLabel)

    await goToFiles(page)
    await selectSidebarAccount(page, originalLabel)
  })

  test('new folder and starter file can be created inside mock run', async ({ page }) => {
    const folderName = `pw-folder-${Date.now()}`
    const baseFileName = `pw-notes-${Date.now()}`

    await stubSavedVpsConnections(page)

    await goToFiles(page)
    await selectSidebarAccount(page, SAVED_VPS_SOURCE_LABEL)
    await openMockRunInUnifiedBrowser(page)

    await createFolderInUnifiedBrowser(page, folderName)
    const fileName = await createStarterFileInUnifiedBrowser(page, baseFileName, 'md')

    await selectFileInUnifiedBrowser(page, fileName)
    await deleteSelectedFileInUnifiedBrowser(page)
    await expectUnifiedBrowserFileMissing(page, fileName)

    await refreshUnifiedBrowser(page)
    await selectFileInUnifiedBrowser(page, folderName)
    await deleteSelectedFileInUnifiedBrowser(page)
    await expectUnifiedBrowserFileMissing(page, folderName)
  })

  test('folder row menu can create into that folder with extended starter templates', async ({ page }) => {
    const nestedFolderName = `pw-inner-${Date.now()}`
    const baseFileName = `pw-style-${Date.now()}`
    const expectedFileName = `${baseFileName}.css`

    await stubSavedVpsConnections(page)
    await cleanupPwArtifactsInDirectory(page, SAVED_VPS_SOURCE_ID, MOCK_RUN_ARCHIVE_PATH)

    await goToFiles(page)
    await selectSidebarAccount(page, SAVED_VPS_SOURCE_LABEL)
    await openMockRunInUnifiedBrowser(page)

    await openRowOverflow(page, 'archive')
    await page.getByTestId('cf-files-row-new-folder-here').click()
    await page.getByTestId('cf-new-folder-name').fill(nestedFolderName)
    await page.getByTestId('cf-create-folder-submit').click()
    await expect(page.getByTestId('cf-new-folder-name')).toHaveCount(0, { timeout: 30_000 })

    await openRowOverflow(page, 'archive')
    await page.getByTestId('cf-files-row-new-file-here').click()
    await page.getByTestId('cf-new-file-name').fill(baseFileName)
    await page.getByTestId('cf-new-file-template').selectOption('css')
    await page.getByTestId('cf-create-file-submit').click()
    await expect(page.getByTestId('cf-new-file-name')).toHaveCount(0, { timeout: 30_000 })

    await ensureFolderOpenInUnifiedBrowser(page, 'archive')
    await expectUnifiedBrowserFile(page, nestedFolderName)
    await expectUnifiedBrowserFile(page, expectedFileName)

    await cleanupPwArtifactsInDirectory(page, SAVED_VPS_SOURCE_ID, MOCK_RUN_ARCHIVE_PATH)
    await refreshUnifiedBrowser(page)
    await expectUnifiedBrowserFileMissing(page, expectedFileName)
    await expectUnifiedBrowserFileMissing(page, nestedFolderName)
  })
})
