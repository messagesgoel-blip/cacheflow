import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const OUT_DIR = '/srv/storage/screenshots/cacheflow/UI Test'
const REPORT_JSON = path.join(OUT_DIR, 'bug-report-2026-03-02-v2.json')
const REPORT_MD = path.join(OUT_DIR, 'bug-report-2026-03-02-v2.md')
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

test('real issue retest v2: overflow actions + ux assessment', async ({ page }) => {
  test.setTimeout(240_000)
  const report: any = {
    target: 'https://cacheflow.goels.in',
    timestamp: new Date().toISOString(),
    checks: {
      cloudDrivesVisibleData: 'unknown',
      drive1: {} as any,
      drive2: {} as any,
    },
    errors: {
      network4xx5xx: [] as any[],
      consoleErrors: [] as string[],
      errorBannerTexts: [] as string[],
      googleRelatedErrors: [] as any[],
    },
    uxFindings: [] as string[],
    screenshots: [] as string[],
  }

  page.on('response', async (res) => {
    if (res.status() >= 400) {
      const item = { status: res.status(), url: res.url() }
      report.errors.network4xx5xx.push(item)
      if (/googleapis|google/i.test(res.url())) report.errors.googleRelatedErrors.push(item)
    }
  })
  page.on('console', (m) => { if (m.type() === 'error') report.errors.consoleErrors.push(m.text()) })

  await page.goto('https://cacheflow.goels.in/login', { waitUntil: 'domcontentloaded' })
  if (!await page.locator('input[placeholder="Email"]').count()) {
    await page.goto('https://cacheflow.goels.in/?mode=login', { waitUntil: 'domcontentloaded' })
  }
  report.screenshots.push(await shot(page, 'v2-01-login'))
  await page.fill('input[placeholder="Email"]', EMAIL)
  await page.fill('input[placeholder="Password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/files|\/$/, { timeout: 30000 })

  await page.goto('https://cacheflow.goels.in/remotes', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const remotesText = await page.locator('body').innerText()
  report.checks.cloudDrivesVisibleData = /No cloud providers connected/i.test(remotesText) ? 'empty' : 'not-empty-or-unclear'
  report.screenshots.push(await shot(page, 'v2-02-remotes-page'))

  await page.goto('https://cacheflow.goels.in/files', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 30000 })
  report.screenshots.push(await shot(page, 'v2-03-files-page'))

  const accounts = page.locator('[data-testid^="cf-sidebar-account-"]')
  const count = await accounts.count()

  async function runOnAccount(i: number, key: string) {
    const out: any = {}
    if (i >= count) { out.status = 'not-available'; return out }

    await accounts.nth(i).click()
    await page.waitForTimeout(1800)
    report.screenshots.push(await shot(page, `${key}-opened`))

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    out.rows = rowCount
    if (!rowCount) { out.status = 'no-files'; return out }

    const firstRow = rows.first()
    const firstVisible = await firstRow.isVisible().catch(() => false)
    if (!firstVisible) {
      out.status = 'first-row-not-visible'
      report.screenshots.push(await shot(page, `${key}-first-row-not-visible`))
      return out
    }
    await firstRow.hover({ timeout: 5000 }).catch(() => {})
    const overflow = firstRow.getByTestId('cf-files-row-overflow')
    if (!await overflow.count()) {
      out.status = 'overflow-not-found'
      report.screenshots.push(await shot(page, `${key}-overflow-missing`))
      return out
    }

    // Open overflow and try actions in sequence.
    async function openMenu() {
      try {
        await firstRow.hover({ timeout: 5000 })
        await overflow.click({ force: true, timeout: 5000 })
        await page.waitForTimeout(300)
        return page.locator('text=/Open|Download|Rename|Move|Copy|Delete/').first().count()
      } catch {
        return 0
      }
    }

    out.menuOpen = await openMenu() ? 'yes' : 'no'
    report.screenshots.push(await shot(page, `${key}-overflow-open`))

    // Open action (preview path)
    if (await page.getByRole('button', { name: /Open/i }).count()) {
      await page.getByRole('button', { name: /Open/i }).click()
      await page.waitForTimeout(1200)
      out.openAction = 'clicked'
      const preview = page.getByTestId('cf-preview-panel')
      out.previewPanel = await preview.count() ? 'opened' : 'not-opened'
      report.screenshots.push(await shot(page, `${key}-after-open-action`))
      if (await preview.count()) {
        // download from preview
        const dl = page.getByTestId('cf-preview-action-download')
        if (await dl.count()) {
          const dlevt = await page.waitForEvent('download', { timeout: 6000 }).catch(() => null)
          await dl.click().catch(() => {})
          out.downloadFromPreview = dlevt ? 'download-event' : 'no-download-event'
        }
        // rename from preview
        const rn = page.getByTestId('cf-preview-action-rename')
        if (await rn.count()) {
          await rn.click(); await page.waitForTimeout(400)
          const modal = page.getByTestId('rename-modal-content')
          if (await modal.count()) {
            const input = modal.locator('input').first()
            const curr = await input.inputValue().catch(() => 'file')
            await input.fill(`${curr}-v2-${Date.now()}`)
            await modal.getByRole('button', { name: /Save/i }).click()
            await page.waitForTimeout(2000)
            out.rename = 'attempted'
          } else out.rename = 'modal-missing'
        }
        // move from preview
        const mv = page.getByTestId('cf-preview-action-move')
        if (await mv.count()) {
          await mv.click(); await page.waitForTimeout(500)
          const tm = page.getByTestId('transfer-modal-content')
          if (await tm.count()) {
            const sel = tm.locator('select[aria-label="Target provider"]').first()
            if (await sel.count()) {
              const vals = await sel.locator('option').evaluateAll((ops: any) => ops.map((o: any) => ({v:o.value,t:o.textContent||''})))
              const target = vals.find((x: any) => x.v && !/select/i.test(x.t))
              if (target) await sel.selectOption(target.v)
            }
            const action = tm.getByRole('button', { name: /Move here|Copy here|Move/i }).first()
            if (await action.count()) await action.click()
            await page.waitForTimeout(2500)
            out.move = 'attempted'
          } else out.move = 'transfer-modal-missing'
        }
        report.screenshots.push(await shot(page, `${key}-after-rename-move-attempts`))
      }
    } else {
      out.openAction = 'open-menu-item-missing'
    }

    // Retry overflow for copy/delete/download direct actions
    await openMenu()
    if (await page.getByRole('button', { name: /^Download$/i }).count()) {
      await page.getByRole('button', { name: /^Download$/i }).click()
      await page.waitForTimeout(1500)
      out.downloadDirect = 'clicked'
    }

    await openMenu()
    if (await page.getByRole('button', { name: /^Copy$/i }).count()) {
      await page.getByRole('button', { name: /^Copy$/i }).click()
      await page.waitForTimeout(1200)
      out.copyDirect = 'clicked'
    }

    // Delete only if item name includes UITEST for safety.
    let firstText = ''
    try {
      firstText = await rows.first().innerText({ timeout: 2000 })
    } catch {
      firstText = ''
    }
    if (/UITEST/i.test(firstText)) {
      await openMenu()
      if (await page.getByRole('button', { name: /^Delete$/i }).count()) {
        await page.getByRole('button', { name: /^Delete$/i }).click()
        await page.getByRole('button', { name: /Delete|Confirm|Yes/i }).first().click().catch(() => {})
        await page.waitForTimeout(1200)
        out.deleteDirect = 'attempted-on-uitest'
      }
    } else {
      out.deleteDirect = 'skipped-non-uitest-file'
    }

    const errBanner = page.getByTestId('cf-error-banner')
    if (await errBanner.count()) {
      const txt = await errBanner.innerText().catch(() => '')
      if (txt) report.errors.errorBannerTexts.push(txt)
      out.errorBanner = txt
    }

    report.screenshots.push(await shot(page, `${key}-final-state`))
    return out
  }

  report.checks.drive1 = await runOnAccount(0, 'drive1')
  report.checks.drive2 = await runOnAccount(1, 'drive2')

  // UX findings based on observed UI behavior + heuristic evaluation
  if (report.checks.cloudDrivesVisibleData !== 'not-empty-or-unclear') {
    report.uxFindings.push('Cloud Drives page lacks clear connected-state visibility and should explicitly list connected accounts with status chips.')
  }
  if (report.checks.drive1.previewPanel === 'not-opened' || report.checks.drive2.previewPanel === 'not-opened') {
    report.uxFindings.push('Primary row click -> preview affordance is unclear/unreliable; add explicit open icon/button and stable selection state.')
  }
  if (report.errors.errorBannerTexts.length === 0 && report.errors.network4xx5xx.length > 0) {
    report.uxFindings.push('Errors are not surfaced consistently in UI; users need inline actionable error feedback near failed actions.')
  }
  report.uxFindings.push('Discoverability: Upload/Create actions are not obvious in main file view; place persistent top-right action buttons.')
  report.uxFindings.push('Consistency: Action locations differ (row overflow, preview panel, selection toolbar); unify operation entry points.')
  report.uxFindings.push('Status visibility: transfer/copy/move outcomes need immediate toast + persistent status row for trust and recoverability.')

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))

  const md = [
    '# CacheFlow Real UI Bug Retest v2',
    '',
    `- Target: ${report.target}`,
    `- Timestamp: ${report.timestamp}`,
    '',
    '## Functional Results',
    `- Cloud Drives visible data state: ${report.checks.cloudDrivesVisibleData}`,
    `- Drive1: ${JSON.stringify(report.checks.drive1)}`,
    `- Drive2: ${JSON.stringify(report.checks.drive2)}`,
    '',
    `## Captured Errors`,
    `- Network 4xx/5xx: ${report.errors.network4xx5xx.length}`,
    `- Google-related errors: ${report.errors.googleRelatedErrors.length}`,
    `- Console errors: ${report.errors.consoleErrors.length}`,
    `- Error banners: ${report.errors.errorBannerTexts.length}`,
    '',
    '## UX Assessment (Human-Centered)',
    ...report.uxFindings.map((x: string) => `- ${x}`),
    '',
    `## Screenshots (${report.screenshots.length})`,
    ...report.screenshots.map((s: string) => `- ${s}`),
  ].join('\n')
  fs.writeFileSync(REPORT_MD, md)
})
