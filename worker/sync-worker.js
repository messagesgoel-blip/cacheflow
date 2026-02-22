'use strict';
require('dotenv').config({ path: '/app/.env' });

const chokidar    = require('chokidar');
const { execFile } = require('child_process');
const path        = require('path');
const fs          = require('fs');
const crypto      = require('crypto');
const { Pool }    = require('pg');

// ── Config ────────────────────────────────────────────────────────────────────
const WATCH_DIR   = process.env.SYNC_WATCH_DIR || '/mnt/local';
const RCLONE_DEST = process.env.RCLONE_DEST    || 'goels:/srv/storage/remotes/parul-main/CacheFlow';
const MIN_AGE_MS  = parseInt(process.env.SYNC_MIN_AGE_MS || '1200000'); // 20 min
const CONFLICT_WINDOW_MS = 300000; // 5 min
const RETRY_DELAYS = [4000, 8000, 16000, 32000, 60000];
const EXCLUDE     = [/\.tmp$/, /\.lock$/, /\.part$/, /~$/];

// Priority: 1=highest. docs > images > video > other
const PRIORITY = { doc:1, docx:1, pdf:1, txt:1, md:1, png:2, jpg:2, jpeg:2, gif:2, mp4:3, mov:3, mkv:3 };
function filePriority(fp) { return PRIORITY[path.extname(fp).slice(1).toLowerCase()] || 4; }

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', err => log('error', 'db pool error', { err: err.message }));

// ── Logger ────────────────────────────────────────────────────────────────────
function log(level, msg, extra = {}) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }) + '\n');
}

function logTransition(fileId, filePath, before, after, reason, durationMs) {
  log('info', 'status transition', { file_id: fileId, file: filePath, status_before: before, status_after: after, reason, duration_ms: durationMs });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function shouldSkip(fp) { return EXCLUDE.some(re => re.test(fp)); }

function ageOk(fp) {
  try { return (Date.now() - fs.statSync(fp).mtimeMs) >= MIN_AGE_MS; }
  catch { return false; }
}

function sha256(fp) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(fp);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ── Stage 1: Detect — find or create DB record ────────────────────────────────
async function stage1Detect(filePath) {
  const rel = path.relative(WATCH_DIR, filePath);
  // Extract user_id from first path segment: /mnt/local/<user_id>/filename
  const parts = rel.split(path.sep);
  const userId = parts[0];
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    log('info', 'stage1: skipping — not in user subfolder', { file: rel });
    return null;
  }

  // Look for existing file record by user + path
  const existing = await pool.query(
    `SELECT id, status, updated_at FROM files WHERE user_id = $1 AND path = $2 LIMIT 1`,
    [userId, rel]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    // Skip if already syncing (in progress) or locked
    if (['syncing', 'locked'].includes(row.status)) {
      log('info', 'stage1: skipping — already in progress or locked', { file: rel, status: row.status });
      return null;
    }
    return { fileId: row.id, userId, rel, isNew: false, prevStatus: row.status };
  }

  // No record — insert as pending
  const hash = await sha256(filePath).catch(() => null);
  let size = 0;
  try { size = fs.statSync(filePath).size; } catch {}

  const inserted = await pool.query(
    `INSERT INTO files (user_id, path, size_bytes, hash, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (user_id, path) DO UPDATE SET status='pending', updated_at=NOW()
     RETURNING id`,
    [userId, rel, size, hash]
  );
  const fileId = inserted.rows[0].id;
  log('info', 'stage1: new file detected', { file: rel, file_id: fileId });
  return { fileId, userId, rel, isNew: true, prevStatus: null };
}

// ── Stage 2: Prioritise — return numeric priority for queue sorting ────────────
function stage2Prioritise(filePath) {
  return filePriority(filePath);
}

// ── Stage 3: Check — quota gate (placeholder) ─────────────────────────────────
async function stage3Check(fileId, userId, rel) {
  // TODO Days 41-45: enforce per-user quota and 750GB/day provider limit
  // For now: always pass
  log('info', 'stage3: quota check passed (placeholder)', { file: rel });
  return true;
}

// ── Stage 4: Upload — rclone copy, transition pending→syncing→done ────────────
async function stage4Upload(fileId, filePath, rel) {
  const t0 = Date.now();
  const dest = `${RCLONE_DEST}/${path.dirname(rel)}`;

  // Mark syncing
  await pool.query(`UPDATE files SET status='syncing', updated_at=NOW() WHERE id=$1`, [fileId]);
  logTransition(fileId, rel, 'pending', 'syncing', 'upload started', Date.now() - t0);

  return new Promise((resolve) => {
    execFile('rclone', [
      'copy', filePath, dest,
      '--checksum',
      '--transfers', '1',
      '--log-level', 'ERROR', '--contimeout', '10s', '--timeout', '60s'
    ], async (err, _stdout, stderr) => {
      const duration = Date.now() - t0;
      if (err) {
        log('error', 'stage4: rclone copy failed', { file: rel, err: stderr.trim(), duration_ms: duration });
        resolve({ ok: false, err: stderr.trim(), duration });
      } else {
        log('info', 'stage4: rclone copy done', { file: rel, duration_ms: duration });
        resolve({ ok: true, duration });
      }
    });
  });
}

// ── Stage 5: Verify — SHA-256 local vs remote ─────────────────────────────────
async function stage5Verify(fileId, filePath, rel, uploadDuration) {
  const t0 = Date.now();

  // Get local hash
  let localHash;
  try { localHash = await sha256(filePath); }
  catch (e) {
    await pool.query(
      `UPDATE files SET status='error', updated_at=NOW() WHERE id=$1`, [fileId]
    );
    logTransition(fileId, rel, 'syncing', 'error', `local hash failed: ${e.message}`, Date.now() - t0);
    return false;
  }

  // SFTP remotes do not support remote hashing - pipe remote file through sha256 locally
  const remotePath = `${RCLONE_DEST}/${rel}`;
  const remoteHash = await new Promise((resolve) => {
    const { spawn } = require("child_process");
    const rclone = spawn("rclone", ["cat", remotePath, "--log-level", "ERROR", "--contimeout", "10s", "--timeout", "30s"]);
    const hash = require("crypto").createHash("sha256");
    rclone.stdout.on("data", d => hash.update(d));
    rclone.stdout.on("end", () => resolve(hash.digest("hex")));
    rclone.on("error", () => resolve(null));
    rclone.stderr.on("data", () => {});
  });

  const duration = Date.now() - t0;

  if (localHash === remoteHash) {
    await pool.query(
      `UPDATE files SET status='synced', hash=$1, updated_at=NOW() WHERE id=$2`,
      [localHash, fileId]
    );
    logTransition(fileId, rel, 'syncing', 'synced', 'hash match', uploadDuration + duration);
    return true;
  } else {
    await pool.query(
      `UPDATE files SET status='error', updated_at=NOW() WHERE id=$1`, [fileId]
    );
    logTransition(fileId, rel, 'syncing', 'error', `hash mismatch local=${localHash?.slice(0,8)} remote=${remoteHash?.slice(0,8)}`, duration);
    return false;
  }
}

// ── Stage 6: Resolve — detect conflict (both modified within 300s) ────────────
async function stage6Resolve(fileId, rel) {
  // Check if a conflict record already exists for this file
  const existing = await pool.query(
    `SELECT id FROM conflicts WHERE file_id=$1 AND resolved_at IS NULL LIMIT 1`,
    [fileId]
  );
  if (existing.rows.length > 0) {
    log('info', 'stage6: conflict already open', { file: rel, file_id: fileId });
    return;
  }

  // Check if file was modified both locally and in cloud within CONFLICT_WINDOW_MS
  const row = await pool.query(
    `SELECT updated_at FROM files WHERE id=$1`, [fileId]
  );
  if (!row.rows.length) return;

  const updatedAt = new Date(row.rows[0].updated_at).getTime();
  const ageMs = Date.now() - updatedAt;

  if (ageMs < CONFLICT_WINDOW_MS) {
    // Mark file as conflict
    await pool.query(`UPDATE files SET status='conflict', updated_at=NOW() WHERE id=$1`, [fileId]);
    await pool.query(
      `INSERT INTO conflicts (file_id, detected_at) VALUES ($1, NOW())`,
      [fileId]
    );
    logTransition(fileId, rel, 'synced', 'conflict', `modified within conflict window (${Math.round(ageMs/1000)}s)`, 0);
  }
}

// ── Retry with exponential backoff ────────────────────────────────────────────
async function runWithRetry(fileId, filePath, rel) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1];
      log('info', 'retry', { file: rel, attempt, delay_ms: delay });
      await new Promise(r => setTimeout(r, delay));

      // Reset to pending before retry
      await pool.query(`UPDATE files SET status='pending', updated_at=NOW() WHERE id=$1`, [fileId]);
    }

    const upload = await stage4Upload(fileId, filePath, rel);
    if (!upload.ok) {
      // Store error reason
      await pool.query(
        `UPDATE files SET status='error', updated_at=NOW() WHERE id=$1`, [fileId]
      );
      logTransition(fileId, rel, 'syncing', 'error', upload.err, upload.duration);
      if (attempt < RETRY_DELAYS.length) continue;
      log('error', 'all retries exhausted', { file: rel, file_id: fileId });
      return false;
    }

    const verified = await stage5Verify(fileId, filePath, rel, upload.duration);
    if (verified) return true;

    if (attempt < RETRY_DELAYS.length) continue;
    log('error', 'verify failed after all retries', { file: rel, file_id: fileId });
    return false;
  }
}

// ── Pipeline entry point ──────────────────────────────────────────────────────
const inFlight = new Set();
const debounceMap = new Map();

async function runPipeline(filePath) {
  if (shouldSkip(filePath)) return;
  if (inFlight.has(filePath)) return;

  const ctx = await stage1Detect(filePath);
  if (!ctx) return;

  const { fileId, userId, rel } = ctx;
  const priority = stage2Prioritise(filePath);
  log('info', 'pipeline start', { file: rel, file_id: fileId, priority });

  const quotaOk = await stage3Check(fileId, userId, rel);
  if (!quotaOk) return;

  inFlight.add(filePath);
  try {
    const success = await runWithRetry(fileId, filePath, rel);
    if (success) await stage6Resolve(fileId, rel);
  } finally {
    inFlight.delete(filePath);
  }
}

function schedule(filePath) {
  if (shouldSkip(filePath)) return;
  if (debounceMap.has(filePath)) clearTimeout(debounceMap.get(filePath));

  let mtimeMs = Date.now();
  try { mtimeMs = fs.statSync(filePath).mtimeMs; } catch {}
  const delay = Math.max(0, MIN_AGE_MS - (Date.now() - mtimeMs));

  const t = setTimeout(async () => {
    debounceMap.delete(filePath);
    if (!ageOk(filePath)) { schedule(filePath); return; }
    await runPipeline(filePath).catch(e =>
      log('error', 'pipeline uncaught', { file: filePath, err: e.message })
    );
  }, delay);

  debounceMap.set(filePath, t);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
log('info', 'sync worker starting', { watchDir: WATCH_DIR, minAgeMs: MIN_AGE_MS, conflictWindowMs: CONFLICT_WINDOW_MS });

// Verify DB connection
pool.query('SELECT NOW()').then(r =>
  log('info', 'db connected', { ts: r.rows[0].now })
).catch(e =>
  log('error', 'db connection failed', { err: e.message })
);

const watcher = chokidar.watch(WATCH_DIR, {
  ignoreInitial:  false,
  persistent:     true,
  awaitWriteFinish: { stabilityThreshold: 5000, pollInterval: 500 },
  ignored:        EXCLUDE
});

watcher
  .on('add',    p => schedule(p))
  .on('change', p => schedule(p))
  .on('error',  e => log('error', 'watcher error', { err: String(e) }))
  .on('ready',  () => log('info', 'initial scan done, watching for changes'));

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down');
  watcher.close().then(() => process.exit(0));
});
// PATCH APPLIED INLINE — see stage1Detect for uuid guard
