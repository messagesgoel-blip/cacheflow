import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const OUT_DIR = '/srv/storage/screenshots/cacheflow/UI Test'
const EMAIL = 'admin@cacheflow.goels.in'
const PASSWORD = 'admin123'

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function shot(page: any, name: string, worker: number) {
  const file = path.join(OUT_DIR, `${stamp()}-w${worker}-${name.replace(/[^a-z0-9-_]+/gi, '_')}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function login(page: any, worker: number) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await shot(page, '01-login-page', worker)
  await page.getByTestId('email-input').fill(EMAIL)
  await page.getByTestId('password-input').fill(PASSWORD)
  await page.getByTestId('submit-button').click()
  await page.waitForURL(/\/files|\/providers|\/remotes|\/$/, { timeout: 30000 })
  await page.goto('/files', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 30000 })
  await shot(page, '02-after-login-files', worker)
}

async function openAllProviders(page: any, worker: number) {
  const accounts = page.locator('[data-testid^="cf-sidebar-account-"]')
  const count = await accounts.count()
  for (let i = 0; i < Math.min(count, 6); i++) {
    await accounts.nth(i).click({ timeout: 10000 })
    await page.waitForTimeout(1500)
    await shot(page, `provider-${i + 1}-opened`, worker)
  }
  return count
}

async function searchOnce(page: any, worker: number) {
  const search = page.getByTestId('cf-global-search-input')
    .or(page.locator('input[placeholder*="Search"]'))
    .or(page.locator('input[aria-label*="Search"]'))
    .or(page.locator('input[type="search"]'))
    .first()
  if (await search.count()) {
    await search.fill('test')
    await page.waitForTimeout(1200)
    await shot(page, 'search-test', worker)
    await search.fill('')
    await page.waitForTimeout(500)
  }
}

async function createFolderUploadDelete(page: any, worker: number) {
  const folderName = `UITEST-${Date.now()}`
  const tmp = `/tmp/${folderName}.txt`
  fs.writeFileSync(tmp, `CacheFlow UI test file ${new Date().toISOString()}\n`)

  // Create folder if available
  const newFolderBtn = page.getByRole('button', { name: /new folder|create folder/i }).first()
  if (await newFolderBtn.count()) {
    await newFolderBtn.click({ timeout: 10000 })
    const nameInput = page.locator('input[placeholder*="folder" i]')
      .or(page.locator('input[name*="folder" i]'))
      .or(page.locator('input[type="text"]'))
      .last()
    if (await nameInput.count()) {
      await nameInput.fill(folderName)
      await page.getByRole('button', { name: /create|save|ok/i }).last().click().catch(async () => {
        await page.keyboard.press('Enter')
      })
      await page.waitForTimeout(1500)
      await shot(page, 'create-folder-attempt', worker)
    }
  }

  // Upload file if input present
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count()) {
    await fileInput.setInputFiles(tmp)
    await page.waitForTimeout(2500)
    await shot(page, 'upload-file-attempt', worker)
  } else {
    const uploadBtn = page.getByRole('button', { name: /upload/i }).first()
    if (await uploadBtn.count()) {
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null)
      await uploadBtn.click({ timeout: 10000 })
      const chooser = await chooserPromise
      if (chooser) {
        await chooser.setFiles(tmp)
        await page.waitForTimeout(2500)
        await shot(page, 'upload-via-chooser-attempt', worker)
      }
    }
  }

  // Try delete uploaded file/folder if row exists
  const row = page.locator('tr', { hasText: folderName }).first()
  if (await row.count()) {
    const cb = row.getByRole('checkbox').first()
    if (await cb.count()) await cb.click({ force: true })
    const del = page.getByRole('button', { name: /^delete$/i }).first()
    if (await del.count()) {
      await del.click()
      await page.getByRole('button', { name: /confirm|delete/i }).last().click().catch(async () => {
        await page.keyboard.press('Enter')
      })
      await page.waitForTimeout(1500)
      await shot(page, 'delete-created-folder-attempt', worker)
    }
  }
}

async function copyMoveBetweenProviders(page: any, worker: number) {
  const accounts = page.locator('[data-testid^="cf-sidebar-account-"]')
  const count = await accounts.count()
  if (count < 2) return

  await accounts.nth(0).click()
  await page.waitForTimeout(1200)

  const firstRow = page.getByTestId('cf-file-row').first()
  if (!await firstRow.count()) return

  const cb = firstRow.getByRole('checkbox').first()
  if (await cb.count()) await cb.click({ force: true })

  const copyBtn = page.getByRole('button', { name: /^copy$/i }).first()
  if (await copyBtn.count()) {
    await copyBtn.click()
    const select = page.locator('select[aria-label="Target provider"]').first()
    if (await select.count()) {
      const options = await select.locator('option').allTextContents()
      const target = options.find((o: string) => o && !/select/i.test(o))
      if (target) await select.selectOption({ label: target }).catch(async () => {
        const vals = await select.locator('option').evaluateAll((ops: any) => ops.map((o: any) => o.value))
        if (vals[1]) await select.selectOption(vals[1])
      })
      const copyHere = page.getByRole('button', { name: /copy here/i }).first()
      if (await copyHere.count()) {
        await copyHere.click()
        await page.waitForTimeout(2500)
        await shot(page, 'copy-between-providers-attempt', worker)
      }
    }
  }

  const queue = page.getByTestId('cf-transfer-queue-panel')
  if (await queue.count()) {
    await shot(page, 'transfer-queue-state', worker)
  }
}

test.describe.configure({ mode: 'parallel' })

test('real site: auth + provider visibility', async ({ page }, testInfo) => {
  await login(page, testInfo.workerIndex)
  const count = await openAllProviders(page, testInfo.workerIndex)
  await searchOnce(page, testInfo.workerIndex)
  await shot(page, `providers-visible-count-${count}`, testInfo.workerIndex)
})

test('real site: provider browsing + search', async ({ page }, testInfo) => {
  await login(page, testInfo.workerIndex)
  await openAllProviders(page, testInfo.workerIndex)
  await page.getByTestId('cf-sidebar-node-all-files').click().catch(() => {})
  await page.waitForTimeout(1200)
  await shot(page, 'all-files-view', testInfo.workerIndex)
  await searchOnce(page, testInfo.workerIndex)
})

test('real site: create/upload/delete operations', async ({ page }, testInfo) => {
  await login(page, testInfo.workerIndex)
  const accounts = page.locator('[data-testid^="cf-sidebar-account-"]')
  if (await accounts.count()) await accounts.nth(0).click()
  await page.waitForTimeout(1200)
  await createFolderUploadDelete(page, testInfo.workerIndex)
})

test('real site: cross-provider copy/move attempts', async ({ page }, testInfo) => {
  await login(page, testInfo.workerIndex)
  await copyMoveBetweenProviders(page, testInfo.workerIndex)
  await shot(page, 'final-cross-provider-state', testInfo.workerIndex)
})
