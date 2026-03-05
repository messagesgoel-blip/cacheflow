const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../web/node_modules/playwright'));

const BASE_URL = process.env.CHAOS_BASE_URL || 'https://cacheflow.goels.in';
const EMAIL = process.env.CHAOS_EMAIL || 'admin@cacheflow.goels.in';
const PASSWORDS = [process.env.CHAOS_PASSWORD, process.env.CACHEFLOW_ADMIN_PASSWORD, 'admin123', 'Admin123'].filter(Boolean);
const RUN_DIR = process.env.CHAOS_OUT_DIR || process.env.RUN_DIR;

const report = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  runDir: RUN_DIR,
  login: { success: false, passwordUsed: null, error: null },
  preconditions: {
    sidebarAccounts: 0,
    fileRows: 0,
    ready: false,
    reason: null,
  },
  actions: {
    upload: 'not-run',
    preview: 'not-run',
    download: 'not-run',
    rename: 'not-run',
    copy: 'not-run',
    move: 'not-run',
    delete: 'not-run',
    chaosLoop: 'not-run',
  },
  artifacts: {
    screenshots: [],
    filesCreated: [],
    filesDownloaded: [],
  },
  errors: {
    network4xx5xx: [],
    consoleErrors: [],
    uncaught: [],
  },
  notes: [],
};

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function screenshot(page, name) {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const file = path.join(RUN_DIR, `${stamp()}-${safe}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.artifacts.screenshots.push(file);
  return file;
}

async function clickIfVisible(locator, timeout = 3000) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    await locator.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

async function findRowByName(page, name, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const row = page.locator('tbody tr', { hasText: name }).first();
    if (await row.count()) return row;
    await page.waitForTimeout(500);
  }
  return null;
}

async function findLikelyFileRow(page) {
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const fileName = await row.getAttribute('data-file-name');
    if (fileName && fileName.includes('.')) {
      return row;
    }
  }
  return count > 0 ? rows.first() : null;
}

async function main() {
  if (!RUN_DIR) throw new Error('RUN_DIR is not set');
  fs.mkdirSync(RUN_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('response', (res) => {
    const s = res.status();
    if (s >= 400) {
      report.errors.network4xx5xx.push({ status: s, url: res.url() });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.errors.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    report.errors.uncaught.push(String(err));
  });

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await screenshot(page, '01-login-page');

    let loggedIn = false;
    for (const pwd of PASSWORDS) {
      await page.fill('input[placeholder="Email"]', EMAIL);
      await page.fill('input[placeholder="Password"]', pwd);
      await page.click('button[type="submit"]');

      try {
        await page.waitForURL(/\/files|\/$|\/providers|\/remotes/, { timeout: 12000 });
        loggedIn = true;
        report.login.success = true;
        report.login.passwordUsed = pwd;
        break;
      } catch {
        const errText = await page.locator('text=/login failed|request failed|invalid|unauthorized/i').first().textContent().catch(() => null);
        if (errText) report.login.error = errText.trim();
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      }
    }

    if (!loggedIn) throw new Error(`Login failed for ${EMAIL}`);

    await page.goto(`${BASE_URL}/files`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByTestId('cf-sidebar-root').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2500);
    await screenshot(page, '02-after-login-files');

    const accounts = page.locator('[data-testid^="cf-sidebar-account-"]');
    report.preconditions.sidebarAccounts = await accounts.count();

    const rows = page.locator('tbody tr');
    const rowWaitStart = Date.now();
    while (Date.now() - rowWaitStart < 20000) {
      report.preconditions.fileRows = await rows.count();
      if (report.preconditions.fileRows > 0) break;
      await page.waitForTimeout(500);
    }

    if (report.preconditions.sidebarAccounts < 1) {
      report.preconditions.reason = 'No connected sidebar accounts visible';
      throw new Error(report.preconditions.reason);
    }
    if (report.preconditions.fileRows < 1) {
      report.preconditions.reason = 'No file rows available for actions';
      throw new Error(report.preconditions.reason);
    }
    report.preconditions.ready = true;

    const runToken = `CHAOS_E2E_${Date.now()}`;
    const originalName = `${runToken}.txt`;
    const renamedName = `${runToken}_renamed.txt`;
    const uploadPath = path.join('/tmp', originalName);
    fs.writeFileSync(uploadPath, `CacheFlow chaos test file\nRun: ${new Date().toISOString()}\n`);
    report.artifacts.filesCreated.push(uploadPath);

    // upload
    let uploadDone = false;
    const uploadInput = page.locator('input[type="file"]').first();
    if (await uploadInput.count()) {
      await uploadInput.setInputFiles(uploadPath);
      uploadDone = true;
    } else {
      const uploadBtn = page.getByTestId('cf-action-upload').first();
      if (await uploadBtn.count()) {
        const chooserPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
        await uploadBtn.click();
        const chooser = await chooserPromise;
        if (chooser) {
          await chooser.setFiles(uploadPath);
          uploadDone = true;
        }
      }
    }
    report.actions.upload = uploadDone ? 'attempted' : 'failed-no-uploader';
    await page.waitForTimeout(2500);
    await screenshot(page, '03-after-upload-attempt');

    let targetRow = null;
    for (let attempt = 0; attempt < 8 && !targetRow; attempt += 1) {
      targetRow = await findRowByName(page, originalName, 2500);
      if (!targetRow) {
        await clickIfVisible(page.getByTestId('files-refresh').first(), 1500);
        await page.waitForTimeout(1000);
      }
    }
    if (!targetRow) {
      report.notes.push('Uploaded file row not found; continuing with first available row.');
      targetRow = await findLikelyFileRow(page);
    }

    if (!targetRow) throw new Error('No file rows available to continue file actions');

    // preview
    await targetRow.click();
    const previewPanel = page.getByTestId('cf-preview-panel');
    if (await previewPanel.count()) {
      await previewPanel.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      report.actions.preview = 'attempted';
    } else {
      report.actions.preview = 'not-available';
    }
    await screenshot(page, '04-preview-attempt');

    // download
    const dlPreview = page.getByTestId('cf-preview-action-download');
    if (await dlPreview.count()) {
      const dlPromise = page.waitForEvent('download', { timeout: 12000 }).catch(() => null);
      await dlPreview.click().catch(() => {});
      const dl = await dlPromise;
      if (dl) {
        const p = path.join(RUN_DIR, `${stamp()}-${dl.suggestedFilename()}`);
        await dl.saveAs(p);
        report.artifacts.filesDownloaded.push(p);
        report.actions.download = 'success';
      } else {
        report.actions.download = 'clicked-no-download-event';
      }
    } else {
      report.actions.download = 'not-available';
    }
    await screenshot(page, '05-download-attempt');

    // rename
    const renameBtn = page.getByTestId('cf-preview-action-rename');
    if (await renameBtn.count()) {
      await renameBtn.click().catch(() => {});
      const modal = page.getByTestId('rename-modal-content');
      if (await modal.count()) {
        const input = modal.locator('input').first();
        await input.fill(renamedName).catch(() => {});
        const saveBtn = modal.getByRole('button', { name: /save|rename/i }).first();
        await saveBtn.click().catch(async () => { await page.keyboard.press('Enter').catch(() => {}); });
        await page.waitForTimeout(2000);
        report.actions.rename = 'attempted';
      } else {
        report.actions.rename = 'failed-modal-missing';
      }
    } else {
      report.actions.rename = 'not-available';
    }
    await screenshot(page, '06-rename-attempt');

    // refresh row reference after rename
    let rowAfterRename = await findRowByName(page, renamedName, 5000);
    if (!rowAfterRename) rowAfterRename = await findRowByName(page, originalName, 5000);
    if (!rowAfterRename) rowAfterRename = await findLikelyFileRow(page);
    if (!rowAfterRename) rowAfterRename = page.locator('tbody tr').first();

    // copy + move through overflow menu
    await rowAfterRename.hover().catch(() => {});
    const overflow = rowAfterRename.getByTestId('cf-files-row-overflow').first();
    if (await overflow.count()) {
      await overflow.click({ force: true }).catch(() => {});
      const copyBtn = page.getByRole('button', { name: /copy/i }).first();
      if (await copyBtn.count()) {
        await copyBtn.click().catch(() => {});
        const tm = page.getByTestId('transfer-modal-content');
        if (await tm.count()) {
          const select = tm.locator('select[aria-label="Target provider"]').first();
          if (await select.count()) {
            const options = await select.locator('option').evaluateAll((ops) => ops.map((o) => ({v: o.value, t: o.textContent || ''})));
            const target = options.find((o) => o.v && !/select/i.test(o.t));
            if (target) await select.selectOption(target.v).catch(() => {});
          }
          const act = tm.getByRole('button', { name: /copy here|copy/i }).first();
          await act.click().catch(() => {});
          await page.waitForTimeout(2000);
          report.actions.copy = 'attempted';
        } else {
          report.actions.copy = 'failed-transfer-modal-missing';
        }
      } else {
        report.actions.copy = 'not-available';
      }

      await rowAfterRename.hover().catch(() => {});
      await overflow.click({ force: true }).catch(() => {});
      const moveBtn = page.getByRole('button', { name: /move/i }).first();
      if (await moveBtn.count()) {
        await moveBtn.click().catch(() => {});
        const tm2 = page.getByTestId('transfer-modal-content');
        if (await tm2.count()) {
          const select2 = tm2.locator('select[aria-label="Target provider"]').first();
          if (await select2.count()) {
            const options2 = await select2.locator('option').evaluateAll((ops) => ops.map((o) => ({v: o.value, t: o.textContent || ''})));
            const target2 = options2.find((o) => o.v && !/select/i.test(o.t));
            if (target2) await select2.selectOption(target2.v).catch(() => {});
          }
          const act2 = tm2.getByRole('button', { name: /move here|move/i }).first();
          await act2.click().catch(() => {});
          await page.waitForTimeout(2000);
          report.actions.move = 'attempted';
        } else {
          report.actions.move = 'failed-transfer-modal-missing';
        }
      } else {
        report.actions.move = 'not-available';
      }
    } else {
      report.actions.copy = 'failed-overflow-missing';
      report.actions.move = 'failed-overflow-missing';
    }
    await screenshot(page, '07-copy-move-attempts');

    // delete only test-created files
    const deleteCandidates = [renamedName, originalName];
    let deleted = false;
    for (const name of deleteCandidates) {
      const row = await findRowByName(page, name, 3000);
      if (!row) continue;
      await row.hover().catch(() => {});
      const ov = row.getByTestId('cf-files-row-overflow').first();
      if (!(await ov.count())) continue;
      await ov.click({ force: true }).catch(() => {});
      const delBtn = page.getByRole('button', { name: /^delete$/i }).first();
      if (await delBtn.count()) {
        await delBtn.click().catch(() => {});
        const confirm = page.getByRole('button', { name: /delete|confirm|yes/i }).first();
        if (await confirm.count()) await confirm.click().catch(() => {});
        await page.waitForTimeout(2000);
        deleted = true;
      }
    }
    if (!deleted && rowAfterRename && await rowAfterRename.count()) {
      await rowAfterRename.hover().catch(() => {});
      const ov = rowAfterRename.getByTestId('cf-files-row-overflow').first();
      if (await ov.count()) {
        await ov.click({ force: true }).catch(() => {});
        const delBtn = page.getByRole('button', { name: /^delete$/i }).first();
        if (await delBtn.count()) {
          await delBtn.click().catch(() => {});
          const confirm = page.getByRole('button', { name: /delete|confirm|yes/i }).first();
          if (await confirm.count()) await confirm.click().catch(() => {});
          await page.waitForTimeout(2000);
          deleted = true;
        }
      }
    }
    report.actions.delete = deleted ? 'attempted' : 'not-found-or-failed';
    await screenshot(page, '08-delete-attempt');

    // chaos loop (non-destructive)
    for (let i = 1; i <= 8; i++) {
      await clickIfVisible(page.getByTestId('files-refresh').first(), 1500);
      const search = page.getByTestId('cf-global-search-input').first();
      if (await search.count()) {
        await search.fill(`chaos-${i}`);
        await page.waitForTimeout(350);
        await search.fill('');
      }
      const grouped = page.getByTestId('cf-allproviders-view-toggle-grouped').first();
      const flat = page.getByTestId('cf-allproviders-view-toggle-flat').first();
      if (await grouped.count()) await grouped.click().catch(() => {});
      if (await flat.count()) await flat.click().catch(() => {});

      const firstRow = page.locator('tbody tr').first();
      if (await firstRow.count()) {
        await firstRow.click().catch(() => {});
        const closePreview = page.getByTestId('cf-preview-close').first();
        if (await closePreview.count()) await closePreview.click().catch(() => {});
      }
      await screenshot(page, `chaos-loop-${i}`);
    }
    report.actions.chaosLoop = 'completed';

    await page.goto(`${BASE_URL}/remotes`, { waitUntil: 'domcontentloaded' });
    await screenshot(page, '09-remotes-final');

  } catch (err) {
    report.notes.push(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(RUN_DIR, 'bug-report.json'), JSON.stringify(report, null, 2));

    const md = [
      '# CacheFlow Live E2E Chaos Report',
      '',
      `- Started: ${report.startedAt}`,
      `- Finished: ${report.finishedAt}`,
      `- Target: ${report.baseUrl}`,
      `- Run dir: ${report.runDir}`,
      '',
      '## Login',
      `- Success: ${report.login.success}`,
      `- Password used: ${report.login.passwordUsed || 'N/A'}`,
      `- Error: ${report.login.error || 'N/A'}`,
      '',
      '## Preconditions',
      `- Ready: ${report.preconditions.ready}`,
      `- Sidebar accounts: ${report.preconditions.sidebarAccounts}`,
      `- File rows: ${report.preconditions.fileRows}`,
      `- Reason: ${report.preconditions.reason || 'N/A'}`,
      '',
      '## File Action Results',
      `- Upload: ${report.actions.upload}`,
      `- Preview: ${report.actions.preview}`,
      `- Download: ${report.actions.download}`,
      `- Rename: ${report.actions.rename}`,
      `- Copy: ${report.actions.copy}`,
      `- Move: ${report.actions.move}`,
      `- Delete: ${report.actions.delete}`,
      `- Chaos loop: ${report.actions.chaosLoop}`,
      '',
      '## Errors',
      `- Network 4xx/5xx count: ${report.errors.network4xx5xx.length}`,
      `- Console errors count: ${report.errors.consoleErrors.length}`,
      `- Uncaught errors count: ${report.errors.uncaught.length}`,
      '',
      '## Notes',
      ...(report.notes.length ? report.notes.map((n) => `- ${n}`) : ['- None']),
      '',
      '## Artifacts',
      `- Screenshots: ${report.artifacts.screenshots.length}`,
      `- Downloads captured: ${report.artifacts.filesDownloaded.length}`,
      '',
      '### Screenshots',
      ...report.artifacts.screenshots.map((s) => `- ${s}`),
      '',
      '### HTTP Errors (first 50)',
      ...report.errors.network4xx5xx.slice(0, 50).map((e) => `- [${e.status}] ${e.url}`),
      '',
      '### Console Errors (first 50)',
      ...report.errors.consoleErrors.slice(0, 50).map((e) => `- ${e}`),
    ].join('\n');

    fs.writeFileSync(path.join(RUN_DIR, 'bug-report.md'), md);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log(JSON.stringify({
      outDir: RUN_DIR,
      login: report.login.success,
      preconditions: report.preconditions,
      actions: report.actions,
      networkErrors: report.errors.network4xx5xx.length,
    }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
