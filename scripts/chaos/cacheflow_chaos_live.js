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
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      const fileName = await row.getAttribute('data-file-name');
      if (fileName === name) return row;
    }
    const rowByText = page.locator('tbody tr', { hasText: name }).first();
    if (await rowByText.count()) return rowByText;
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

async function waitForNameCountBelow(page, name, threshold, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const matches = await collectFileMatches(page, name);
    if (matches.length < threshold) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function providerKeywords(providerId, providerLabel) {
  const explicit = normalizeText(providerLabel).toUpperCase();
  const byId = {
    google: ['GOOGLE', 'GOOGLE DRIVE'],
    onedrive: ['ONEDRIVE', 'ONE DRIVE'],
    dropbox: ['DROPBOX'],
    box: ['BOX'],
    pcloud: ['PCLOUD', 'P CLOUD'],
    filen: ['FILEN'],
    yandex: ['YANDEX'],
    webdav: ['WEBDAV'],
    vps: ['VPS', 'SFTP'],
    local: ['LOCAL'],
  };
  return Array.from(new Set([explicit, ...(byId[providerId] || [])].filter(Boolean)));
}

async function collectFileMatches(page, name) {
  return page.locator('tbody tr').evaluateAll((rows, expectedName) => {
    return rows.flatMap((row) => {
      const fileName = row.getAttribute('data-file-name');
      if (fileName !== expectedName) return [];

      const cells = Array.from(row.querySelectorAll('td'))
        .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const section = row.closest('section[data-testid^="cf-allproviders-group-section-"]');
      const sectionLabel = section?.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim() || '';

      return [{
        fileId: row.getAttribute('data-file-id') || '',
        fileName,
        sectionLabel,
        rowText: (row.textContent || '').replace(/\s+/g, ' ').trim(),
        providerCell: cells.length >= 7 ? cells[3] || '' : '',
      }];
    });
  }, name);
}

function countMatchesForProvider(matches, providerId, providerLabel) {
  const keywords = providerKeywords(providerId, providerLabel);
  return matches.filter((match) => {
    const haystack = `${match.sectionLabel} ${match.providerCell} ${match.rowText}`.toUpperCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  }).length;
}

function countMatchesForLocation(matches, locationKey) {
  if (!locationKey) return 0;
  return matches.filter((match) => match.sectionLabel === locationKey).length;
}

function describeMatches(matches) {
  return matches.map((match) => ({
    section: match.sectionLabel || 'n/a',
    providerCell: match.providerCell || 'n/a',
    fileId: match.fileId || 'n/a',
  }));
}

async function refreshAllFilesView(page) {
  await clickIfVisible(page.getByTestId('cf-sidebar-node-all-files').first(), 1500);
  const grouped = page.getByTestId('cf-allproviders-view-toggle-grouped').first();
  if (await grouped.count()) {
    const isPressed = (await grouped.getAttribute('aria-pressed').catch(() => 'false')) === 'true';
    if (!isPressed) {
      await grouped.click({ timeout: 2000 }).catch(() => {});
    }
  }
  await clickIfVisible(page.getByTestId('files-refresh').first(), 1500);
  await page.waitForTimeout(1500);
}

async function waitForQueueTerminalState(page, fileName, timeout = 45000) {
  const panel = page.getByTestId('cf-transfer-queue-panel');
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const item = panel.locator('[data-testid^="cf-transfer-queue-item-"]', { hasText: fileName }).last();
    if (await item.count()) {
      const text = normalizeText(await item.textContent().catch(() => ''));
      if (/FAILED/i.test(text)) return { state: 'failed', text };
      if (/COMPLETED/i.test(text)) return { state: 'completed', text };
    }
    await page.waitForTimeout(1000);
  }

  return { state: 'timeout', text: '' };
}

async function waitForDistribution(page, { name, timeout = 20000, predicate }) {
  const start = Date.now();
  let lastMatches = [];
  while (Date.now() - start < timeout) {
    await refreshAllFilesView(page);
    lastMatches = await collectFileMatches(page, name);
    if (predicate(lastMatches)) {
      return { ok: true, matches: lastMatches };
    }
    await page.waitForTimeout(1000);
  }
  return { ok: false, matches: lastMatches };
}

async function reopenPreviewForFile(page, name, preferredSectionLabel = '') {
  await refreshAllFilesView(page);
  const rows = page.locator('tbody tr');
  const count = await rows.count();

  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const fileName = await row.getAttribute('data-file-name');
    if (fileName !== name) continue;

    if (preferredSectionLabel) {
      const sectionLabel = await row.evaluate((element) => {
        const section = element.closest('section[data-testid^="cf-allproviders-group-section-"]');
        return section?.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      }).catch(() => '');
      if (sectionLabel && sectionLabel !== preferredSectionLabel) continue;
    }

    await row.click({ timeout: 3000 }).catch(() => {});
    const visible = await page.getByTestId('cf-preview-panel').waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (visible) return true;
  }

  return false;
}

async function ensureTransferTarget(modal, options = {}) {
  const { excludeValues = [] } = options;
  const select = modal.locator('select[aria-label="Target provider"]').first();
  if (!(await select.count())) return null;

  const choices = await select.locator('option').evaluateAll((ops) =>
    ops.map((o) => ({ value: o.value, text: o.textContent || '' }))
  );
  const currentValue = await select.inputValue().catch(() => '');
  let selected = choices.find((option) => option.value === currentValue) || null;

  if (!selected || excludeValues.includes(selected.value) || !selected.value) {
    const target = choices.find((option) => option.value && !excludeValues.includes(option.value) && !/select/i.test(option.text));
    if (!target) return null;
    await select.selectOption(target.value).catch(() => {});
    selected = target;
  }

  return {
    value: selected.value,
    label: normalizeText(selected.text),
  };
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
    await page.waitForTimeout(5000);
    await screenshot(page, '03-after-upload-attempt');

    let targetRow = null;
    for (let attempt = 0; attempt < 12 && !targetRow; attempt += 1) {
      targetRow = await findRowByName(page, originalName, 2500);
      if (!targetRow) {
        const uploadBanner = page.getByText(/uploading/i).first();
        if (await uploadBanner.count()) {
          await page.waitForTimeout(1000);
        }
        await clickIfVisible(page.getByTestId('files-refresh').first(), 1500);
        await page.waitForTimeout(1000);
      }
    }
    const uploadedRow = targetRow;
    if (!targetRow) {
      report.notes.push('Uploaded file row not found; continuing with first available row.');
      targetRow = await findLikelyFileRow(page);
    }

    if (!targetRow) throw new Error('No file rows available to continue file actions');
    report.actions.upload = uploadedRow ? 'success' : 'failed-row-missing';

    // preview
    await targetRow.click();
    const previewPanel = page.getByTestId('cf-preview-panel');
    const previewVisible = await previewPanel.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (previewVisible) {
      const textPreviewVisible = await previewPanel.getByText(/CacheFlow QA mock file/i).first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      const previewFailed = await previewPanel.getByText(/preview not available|could not load preview/i).first().count().catch(() => 0);
      report.actions.preview = textPreviewVisible ? 'success' : (previewFailed ? 'failed' : 'panel-only');
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
      } else {
        report.actions.rename = 'failed-modal-missing';
      }
    } else {
      report.actions.rename = 'not-available';
    }
    await screenshot(page, '06-rename-attempt');

    // refresh row reference after rename
    const renamedRowExact = await findRowByName(page, renamedName, 5000);
    let rowAfterRename = renamedRowExact;
    report.actions.rename = renamedRowExact ? 'success' : 'failed-row-missing';
    if (!rowAfterRename) rowAfterRename = await findRowByName(page, originalName, 5000);
    if (!rowAfterRename) rowAfterRename = await findLikelyFileRow(page);
    if (!rowAfterRename) rowAfterRename = page.locator('tbody tr').first();

    await refreshAllFilesView(page);
    const sourceMatchesBeforeTransfer = await collectFileMatches(page, renamedName);
    const sourceLocationKey = sourceMatchesBeforeTransfer[0]?.sectionLabel || '';

    // copy + move from preview panel actions
    const copyAction = page.getByTestId('cf-preview-action-copy').first();
    if (await copyAction.count()) {
      const copyMatchesBefore = await collectFileMatches(page, renamedName);
      await copyAction.scrollIntoViewIfNeeded().catch(() => {});
      await copyAction.click({ force: true }).catch(() => {});
      const tm = page.getByTestId('transfer-modal-content');
      const opened = await tm.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (opened) {
        const copyTarget = await ensureTransferTarget(tm, { excludeValues: [(rowAfterRename && (await rowAfterRename.getAttribute('data-provider-id').catch(() => ''))) || ''] });
        const act = tm.getByRole('button', { name: /copy here|copy/i }).first();
        await act.click().catch(() => {});
        const closed = await tm.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false);
        if (!closed || !copyTarget) {
          report.actions.copy = closed ? 'failed-target-missing' : 'failed-modal-stuck';
        } else {
          const targetCountBefore = countMatchesForProvider(copyMatchesBefore, copyTarget.value, copyTarget.label);
          const sourceCountBefore = countMatchesForLocation(copyMatchesBefore, sourceLocationKey);
          const distribution = await waitForDistribution(page, {
            name: renamedName,
            timeout: 20000,
            predicate: (matches) => {
              const targetCount = countMatchesForProvider(matches, copyTarget.value, copyTarget.label);
              const sourceCount = countMatchesForLocation(matches, sourceLocationKey);
              return targetCount > targetCountBefore && sourceCount >= sourceCountBefore;
            },
          });
          const queueState = distribution.ok
            ? await waitForQueueTerminalState(page, renamedName, 5000)
            : await waitForQueueTerminalState(page, renamedName, 20000);

          if (distribution.ok) {
            report.actions.copy = 'success';
            if (queueState.state !== 'completed') {
              report.notes.push(`Copy verified by file placement but queue terminal state was ${queueState.state || 'missing'} for ${renamedName}`);
            }
          } else if (queueState.state === 'failed') {
            report.actions.copy = 'failed-transfer';
            report.notes.push(`Copy transfer failed for ${renamedName}: ${JSON.stringify({ queueState, before: describeMatches(copyMatchesBefore), after: describeMatches(distribution.matches), target: copyTarget })}`);
          } else {
            report.actions.copy = queueState.state === 'timeout' ? 'failed-timeout' : 'failed-verification';
            report.notes.push(`Copy verification mismatch for ${renamedName}: ${JSON.stringify({
              queueState,
              before: describeMatches(copyMatchesBefore),
              after: describeMatches(distribution.matches),
              target: copyTarget,
            })}`);
          }
        }
      } else {
        report.actions.copy = 'failed-transfer-modal-missing';
      }
    } else {
      report.actions.copy = 'not-available';
    }

    let moveAction = page.getByTestId('cf-preview-action-move').first();
    if (!(await moveAction.count())) {
      await reopenPreviewForFile(page, renamedName, sourceLocationKey);
      moveAction = page.getByTestId('cf-preview-action-move').first();
    }
    if (await moveAction.count()) {
      const moveMatchesBefore = await collectFileMatches(page, renamedName);
      await moveAction.scrollIntoViewIfNeeded().catch(() => {});
      await moveAction.click({ force: true }).catch(() => {});
      const tm2 = page.getByTestId('transfer-modal-content');
      const opened = await tm2.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (opened) {
        const moveTarget = await ensureTransferTarget(tm2);
        const act2 = tm2.getByRole('button', { name: /move here|move/i }).first();
        await act2.click().catch(() => {});
        const closed = await tm2.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false);
        if (!closed || !moveTarget) {
          report.actions.move = closed ? 'failed-target-missing' : 'failed-modal-stuck';
        } else {
          const targetCountBefore = countMatchesForProvider(moveMatchesBefore, moveTarget.value, moveTarget.label);
          const sourceCountBefore = countMatchesForLocation(moveMatchesBefore, sourceLocationKey);
          const distribution = await waitForDistribution(page, {
            name: renamedName,
            timeout: 20000,
            predicate: (matches) => {
              const targetCount = countMatchesForProvider(matches, moveTarget.value, moveTarget.label);
              const sourceCount = countMatchesForLocation(matches, sourceLocationKey);
              return targetCount > targetCountBefore && sourceCount < sourceCountBefore;
            },
          });
          const queueState = distribution.ok
            ? await waitForQueueTerminalState(page, renamedName, 5000)
            : await waitForQueueTerminalState(page, renamedName, 20000);

          if (distribution.ok) {
            report.actions.move = 'success';
            if (queueState.state !== 'completed') {
              report.notes.push(`Move verified by file placement but queue terminal state was ${queueState.state || 'missing'} for ${renamedName}`);
            }
          } else if (queueState.state === 'failed') {
            report.actions.move = 'failed-transfer';
            report.notes.push(`Move transfer failed for ${renamedName}: ${JSON.stringify({ queueState, before: describeMatches(moveMatchesBefore), after: describeMatches(distribution.matches), target: moveTarget, sourceLocationKey })}`);
          } else {
            report.actions.move = queueState.state === 'timeout' ? 'failed-timeout' : 'failed-verification';
            report.notes.push(`Move verification mismatch for ${renamedName}: ${JSON.stringify({
              queueState,
              before: describeMatches(moveMatchesBefore),
              after: describeMatches(distribution.matches),
              target: moveTarget,
              sourceLocationKey,
            })}`);
          }
        }
      } else {
        report.actions.move = 'failed-transfer-modal-missing';
      }
    } else {
      report.actions.move = 'not-available';
    }
    await screenshot(page, '07-copy-move-attempts');

    // delete from preview panel so the confirm selector is unambiguous
    const currentName = renamedRowExact ? renamedName : originalName;
    let deleteAction = page.getByTestId('cf-preview-action-delete').first();
    if (!(await deleteAction.count())) {
      await reopenPreviewForFile(page, renamedName);
      deleteAction = page.getByTestId('cf-preview-action-delete').first();
    }
    if (await deleteAction.count()) {
      const deleteMatchesBefore = await collectFileMatches(page, currentName);
      await deleteAction.click().catch(() => {});
      const confirmModal = page.getByTestId('cf-confirm-modal');
      const confirmVisible = await confirmModal.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (confirmVisible) {
        await page.getByTestId('cf-confirm-confirm').click().catch(() => {});
        const modalClosed = await confirmModal.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false);
        const rowRemoved = await waitForNameCountBelow(page, currentName, deleteMatchesBefore.length, 10000);
        report.actions.delete = modalClosed && rowRemoved ? 'success' : 'failed-persisted';
        if (!rowRemoved) {
          const deleteMatchesAfter = await collectFileMatches(page, currentName);
          report.notes.push(`Delete verification mismatch for ${currentName}: ${JSON.stringify({
            before: describeMatches(deleteMatchesBefore),
            after: describeMatches(deleteMatchesAfter),
          })}`);
        }
      } else {
        report.actions.delete = 'failed-confirm-missing';
      }
    } else {
      report.actions.delete = 'not-available';
    }
    await screenshot(page, '08-delete-attempt');

    // chaos loop (non-destructive)
    for (let i = 1; i <= 8; i++) {
      await clickIfVisible(page.getByTestId('files-refresh').first(), 1500);
      const search = page.getByTestId('cf-global-search-input').first();
      if (await search.count()) {
        await search.fill(`chaos-${i}`, { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(350);
        await search.fill('', { timeout: 3000 }).catch(() => {});
      }
      const grouped = page.getByTestId('cf-allproviders-view-toggle-grouped').first();
      const flat = page.getByTestId('cf-allproviders-view-toggle-flat').first();
      if (await grouped.count()) await grouped.click({ timeout: 3000 }).catch(() => {});
      if (await flat.count()) await flat.click({ timeout: 3000 }).catch(() => {});

      const firstRow = page.locator('tbody tr').first();
      if (await firstRow.count()) {
        await firstRow.click({ timeout: 3000 }).catch(() => {});
        const closePreview = page.getByTestId('cf-preview-close').first();
        if (await closePreview.count()) await closePreview.click({ timeout: 3000 }).catch(() => {});
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

