import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const OUT_DIR = '/srv/storage/screenshots/cacheflow/UI Test'
const REPORT_JSON = path.join(OUT_DIR, 'bug-report-2026-03-02.json')
const REPORT_MD = path.join(OUT_DIR, 'bug-report-2026-03-02.md')
const EMAIL = 'admin@cacheflow.goels.in'
const PASSWORD = 'admin123'

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

function ts() { return new Date().toISOString().replace(/[:.]/g, '-') }
async function shot(page: any, name: string) {
  const p = path.join(OUT_DIR, `${ts()}-${name.replace(/[^a-z0-9-_]+/gi, '_')}.png`)
  try {
    if (page.isClosed()) return `SKIPPED_CLOSED:${name}`
    await page.screenshot({ path: p, fullPage: true, timeout: 15000 })
    return p
  } catch (e: any) {
    return `SHOT_FAILED:${name}:${e?.message || 'unknown'}`
  }
}

test('real issue retest: cloud drives, preview, rename/move errors, provider add, file ops', async ({ page, context }) => {
  test.setTimeout(300_000)
  const report: any = {
    target: 'https://cacheflow.goels.in',
    timestamp: new Date().toISOString(),
    credentials: { email: EMAIL },
    checks: {
      cloudDrivesPage: { pass: false, details: '' },
      previewLoads: { pass: false, details: '' },
      renameMoveGoogleApiError: { pass: false, details: '' },
      providerAddAttempts: {} as Record<string, string>,
      drive1Ops: {} as Record<string, string>,
      drive2Ops: {} as Record<string, string>,
    },
    screenshots: [] as string[],
    networkErrors: [] as any[],
    uiErrors: [] as string[],
  }

  page.on('response', async (res) => {
    if (!res.ok() && res.status() >= 400) {
      const url = res.url()
      if (url.includes('google') || url.includes('/proxy') || url.includes('/api/')) {
        report.networkErrors.push({ status: res.status(), url })
      }
    }
  })
  page.on('console', (m) => {
    if (m.type() === 'error') report.uiErrors.push(m.text())
  })

  // login
  await page.goto('https://cacheflow.goels.in/login', { waitUntil: 'domcontentloaded' })
  if (!await page.locator('input[placeholder="Email"]').count()) {
    await page.goto('https://cacheflow.goels.in/?mode=login', { waitUntil: 'domcontentloaded' })
  }
  report.screenshots.push(await shot(page, '01-login-page'))
  await page.fill('input[placeholder="Email"]', EMAIL)
  await page.fill('input[placeholder="Password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/files|\/$/, { timeout: 30000 })
  await page.goto('https://cacheflow.goels.in/files', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 30000 })
  report.screenshots.push(await shot(page, '02-files-after-login'))

  // Cloud drives page check
  await page.goto('https://cacheflow.goels.in/remotes', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const noConnected = await page.getByText(/No cloud providers connected/i).count()
  const hasDriveNames = await page.locator('text=/Google|Dropbox|OneDrive|Box|pCloud|Filen|Yandex/i').count()
  report.checks.cloudDrivesPage.pass = noConnected === 0 && hasDriveNames > 0
  report.checks.cloudDrivesPage.details = `noConnectedText=${noConnected}, driveNameMatches=${hasDriveNames}`
  report.screenshots.push(await shot(page, '03-cloud-drives-page'))

  // Providers page: attempt add/connect all providers
  await page.goto('https://cacheflow.goels.in/providers', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  report.screenshots.push(await shot(page, '04-providers-page'))

  const providers = (process.env.PLAYWRIGHT_QA_PROVIDER_SET
    ? process.env.PLAYWRIGHT_QA_PROVIDER_SET.split(',').map((x) => x.trim()).filter(Boolean)
    : ['Google Drive', 'Dropbox'])
  for (const pName of providers) {
    try {
      const card = page.locator('div', { hasText: pName }).first()
      if (!await card.count()) { report.checks.providerAddAttempts[pName] = 'card-not-found'; continue }
      const btn = card.getByRole('button', { name: /Connect|Manage/i }).first()
      if (!await btn.count()) { report.checks.providerAddAttempts[pName] = 'no-connect-manage-button'; continue }
      await btn.click({ timeout: 4000 })
      await page.waitForTimeout(500)
      report.screenshots.push(await shot(page, `provider-modal-${pName}`))
      const authBtn = page.getByRole('button', { name: /Authorize|Connecting/i }).first()
      if (await authBtn.count()) {
        report.checks.providerAddAttempts[pName] = 'modal-opened-authorize-available'
      } else {
        report.checks.providerAddAttempts[pName] = 'modal-opened'
      }
      await page.keyboard.press('Escape').catch(() => {})
      const cancel = page.getByRole('button', { name: /Cancel|Close/i }).first()
      if (await cancel.count()) await cancel.click().catch(() => {})
      await page.waitForTimeout(200)
    } catch (e: any) {
      report.checks.providerAddAttempts[pName] = `error: ${e.message}`
      report.screenshots.push(await shot(page, `provider-modal-error-${pName}`))
    }
  }

  // Files page for drive operations
  await page.goto('https://cacheflow.goels.in/files', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  report.screenshots.push(await shot(page, '05-files-main-before-ops'))

  const accounts = page.locator('[data-testid^="cf-sidebar-account-"]')
  const accountCount = await accounts.count()
  const driveTargets = Math.min(accountCount, 1)

  async function performOpsOnDrive(idx: number, bucket: any) {
      const rowPrefix = `drive${idx + 1}`
      try {
        await accounts.nth(idx).click({ timeout: 10000 })
      await page.waitForTimeout(800)
      report.screenshots.push(await shot(page, `${rowPrefix}-opened`))

      const rows = page.locator('tbody tr')
      const rowCount = await rows.count()
      if (rowCount === 0) { bucket.open = 'no-files-visible'; return }
      bucket.open = `ok-rows=${rowCount}`

      bucket.upload = 'skipped-in-smoke-retest'
      report.screenshots.push(await shot(page, `${rowPrefix}-after-upload-attempt`))

      // pick first file row and open preview
      const firstRow = rows.first()
      await firstRow.click({ timeout: 10000 })
      await page.waitForTimeout(500)
      const preview = page.getByTestId('cf-preview-panel')
      if (await preview.count()) {
        report.screenshots.push(await shot(page, `${rowPrefix}-preview-open`))
        const previewText = await preview.innerText().catch(() => '')
        const hasNoPreview = /Preview not available/i.test(previewText)
        bucket.preview = hasNoPreview ? 'opened-no-render' : 'opened'

        // download
        try {
          const dlBtn = page.getByTestId('cf-preview-action-download')
          if (await dlBtn.count()) {
            const dl = await page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
            await dlBtn.click()
            bucket.download = dl ? 'download-event' : 'clicked-no-download-event'
          } else bucket.download = 'download-button-missing'
        } catch (e: any) { bucket.download = `error: ${e.message}` }

        // rename
        try {
          const rnBtn = page.getByTestId('cf-preview-action-rename')
          if (await rnBtn.count()) {
            await rnBtn.click(); await page.waitForTimeout(500)
            const renameModal = page.getByTestId('rename-modal-content')
            if (await renameModal.count()) {
              const input = renameModal.locator('input').first()
              const oldVal = await input.inputValue().catch(() => 'file')
              const newName = `${oldVal.replace(/\.[^/.]+$/, '')}-UITEST-${Date.now()}.txt`
              await input.fill(newName)
              await renameModal.getByRole('button', { name: /Save/i }).click()
              await page.waitForTimeout(1000)
              bucket.rename = 'attempted'
            } else bucket.rename = 'rename-modal-missing'
          } else bucket.rename = 'rename-button-missing'
        } catch (e: any) { bucket.rename = `error: ${e.message}` }
        report.screenshots.push(await shot(page, `${rowPrefix}-after-rename-attempt`))

        // move
        try {
          const mvBtn = page.getByTestId('cf-preview-action-move')
          if (await mvBtn.count()) {
            await mvBtn.click(); await page.waitForTimeout(700)
            const tm = page.getByTestId('transfer-modal-content')
            if (await tm.count()) {
              const sel = tm.locator('select[aria-label="Target provider"]').first()
              if (await sel.count()) {
                const vals = await sel.locator('option').evaluateAll((ops: any) => ops.map((o: any) => ({v:o.value,t:o.textContent||''})))
                const candidate = vals.find((x: any) => x.v && !/select/i.test(x.t))
                if (candidate) await sel.selectOption(candidate.v)
              }
              const moveHere = tm.getByRole('button', { name: /Move here|Copy here|Move/i }).first()
              if (await moveHere.count()) await moveHere.click()
              await page.waitForTimeout(1000)
              bucket.move = 'attempted'
            } else bucket.move = 'transfer-modal-missing'
          } else bucket.move = 'move-button-missing'
        } catch (e: any) { bucket.move = `error: ${e.message}` }
        report.screenshots.push(await shot(page, `${rowPrefix}-after-move-attempt`))

        bucket.delete = 'skipped-in-smoke-retest'
        report.screenshots.push(await shot(page, `${rowPrefix}-after-delete-attempt`))
      } else {
        bucket.preview = 'preview-panel-not-opened'
        report.screenshots.push(await shot(page, `${rowPrefix}-preview-missing`))
      }

      // Collect visible error banner if any
      const errBanner = page.getByTestId('cf-error-banner')
      if (await errBanner.count()) {
        const txt = await errBanner.innerText().catch(() => '')
        bucket.errorBanner = txt
      }

    } catch (e: any) {
      bucket.fatal = e.message
      report.screenshots.push(await shot(page, `${rowPrefix}-fatal`))
    }
  }

  if (driveTargets > 0) await performOpsOnDrive(0, report.checks.drive1Ops)
  if (driveTargets > 1) await performOpsOnDrive(1, report.checks.drive2Ops)

  // Evaluate key issues requested
  const cloudPass = report.checks.cloudDrivesPage.pass
  const previewSignals = [report.checks.drive1Ops.preview, report.checks.drive2Ops.preview].filter(Boolean)
  report.checks.previewLoads.pass = previewSignals.some((s: string) => s === 'opened')
  report.checks.previewLoads.details = `signals=${previewSignals.join(',')}`

  const googleApiErr = report.networkErrors.find((e: any) => /googleapis|google/i.test(e.url) && e.status >= 400)
  const explicitApiText = JSON.stringify(report.checks).toLowerCase().includes('google api error')
  report.checks.renameMoveGoogleApiError.pass = Boolean(googleApiErr || explicitApiText)
  report.checks.renameMoveGoogleApiError.details = googleApiErr ? `status=${googleApiErr.status} url=${googleApiErr.url}` : 'not-observed-in-this-run'

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))

  const md = [
    '# CacheFlow Real UI Bug Retest (Fresh Run)',
    '',
    `- Target: ${report.target}`,
    `- Timestamp: ${report.timestamp}`,
    `- Credentials: ${EMAIL}`,
    '',
    '## Issue Checks',
    `- Cloud Drives page populated: ${report.checks.cloudDrivesPage.pass ? 'PASS' : 'FAIL'} (${report.checks.cloudDrivesPage.details})`,
    `- Preview loads content: ${report.checks.previewLoads.pass ? 'PASS' : 'FAIL'} (${report.checks.previewLoads.details})`,
    `- Rename/Move Google API error observed: ${report.checks.renameMoveGoogleApiError.pass ? 'YES' : 'NO'} (${report.checks.renameMoveGoogleApiError.details})`,
    '',
    '## Provider Add Attempts',
    ...Object.entries(report.checks.providerAddAttempts).map(([k,v]) => `- ${k}: ${v}`),
    '',
    '## Drive 1 Ops',
    ...Object.entries(report.checks.drive1Ops).map(([k,v]) => `- ${k}: ${v}`),
    '',
    '## Drive 2 Ops',
    ...Object.entries(report.checks.drive2Ops).map(([k,v]) => `- ${k}: ${v}`),
    '',
    `## Network Errors (${report.networkErrors.length})`,
    ...report.networkErrors.slice(0, 30).map((e: any) => `- ${e.status} ${e.url}`),
    '',
    `## Screenshots (${report.screenshots.length})`,
    ...report.screenshots.map((s: string) => `- ${s}`),
  ].join('\n')

  fs.writeFileSync(REPORT_MD, md)
})

