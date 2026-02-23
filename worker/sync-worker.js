'use strict';
require('dotenv').config({ path: '/app/.env' });

const chokidar    = require('chokidar');
const { execFile } = require('child_process');
const path        = require('path');
const fs          = require('fs');
const crypto      = require('crypto');
const { Pool }    = require('pg');

// ── Redis ────────────────────────────────────────────────────────────────────
const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST || 'cacheflow-redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryStrategy: times => Math.min(times * 500, 5000)
});
redis.on('error', err => log('warn', 'redis error', { err: err.message }));
redis.on('connect', () => log('info', 'redis connected'));

const DAILY_TRANSFER_LIMIT = parseInt(process.env.DAILY_TRANSFER_LIMIT_BYTES || String(750 * 1024 * 1024 * 1024));

async function getDailyTransferKey(userId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `cacheflow:transfer:${userId}:${today}`;
}

async function checkAndIncrementTransfer(userId, sizeBytes) {
  try {
    const key = await getDailyTransferKey(userId);
    // Atomic increment first, then check — prevents TOCTOU race under concurrency
    const newTotal = await redis.incrby(key, sizeBytes);
    await redis.expire(key, 90000);
    if (newTotal > DAILY_TRANSFER_LIMIT) {
      // Roll back — this file won't be transferred today
      await redis.decrby(key, sizeBytes);
      return { allowed: false, current: newTotal, limit: DAILY_TRANSFER_LIMIT };
    }
    return { allowed: true, current: newTotal, limit: DAILY_TRANSFER_LIMIT };
  } catch (err) {
    // Redis failure is non-fatal — allow transfer but log
    log('warn', 'redis transfer check failed, allowing', { err: err.message });
    return { allowed: true };
  }
}

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

  // Validate user exists in DB — skip orphan folders from deleted/old test users
  const userCheck = await pool.query(
    `SELECT 1 FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  if (!userCheck.rows.length) {
    log('info', 'stage1: skipping — unknown user folder (not in DB)', { userId, file: rel });
    return null;
  }

  // Look for existing file record by user + path
  const existing = await pool.query(
    `SELECT id, status, updated_at FROM files WHERE user_id = $1 AND path = $2 LIMIT 1`,
    [userId, rel]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    // Skip if already syncing, locked, or synced (unless modified after sync)
    if (['syncing', 'locked'].includes(row.status)) {
      log('info', 'stage1: skipping — already in progress or locked', { file: rel, status: row.status });
      return null;
    }
    // Skip synced files that haven't been modified since last sync
    if (row.status === 'synced' && row.synced_at) {
      let mtime = Date.now();
      try { mtime = require('fs').statSync(filePath).mtimeMs; } catch {}
      const syncedAt = new Date(row.synced_at).getTime();
      if (mtime <= syncedAt + 5000) {
        log('info', 'stage1: skipping — already synced and unmodified', { file: rel });
        return null;
      }
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

// ── Stage 3: Check — quota gate ─────────────────────────────────────────────
async function stage3Check(fileId, userId, rel) {
  const result = await pool.query(
    `SELECT u.quota_bytes, u.used_bytes, f.size_bytes
     FROM users u JOIN files f ON f.user_id = u.id
     WHERE f.id = $1`, [fileId]
  );
  if (!result.rows.length) {
    log('warn', 'stage3: file or user not found', { file: rel });
    return false;
  }
  const { quota_bytes, used_bytes, size_bytes } = result.rows[0];
  if (used_bytes + size_bytes > quota_bytes) {
    await pool.query(
      `UPDATE files SET status='error', error_reason=$2, updated_at=NOW() WHERE id=$1`,
      [fileId, `quota exceeded: ${used_bytes + size_bytes} > ${quota_bytes}`]
    );
    log('warn', 'stage3: quota exceeded', { file: rel, used_bytes, quota_bytes, size_bytes });
    return false;
  }
  log('info', 'stage3: quota check passed', { file: rel, used_bytes, quota_bytes });
  return true;
}

// ── Stage 4: Upload — rclone copy, transition pending→syncing→done ────────────
async function stage4Upload(fileId, filePath, rel) {
  const t0 = Date.now();
  const dest = `${RCLONE_DEST}/${path.dirname(rel)}`;


  // Daily transfer limit check BEFORE marking syncing (size_bytes parsed as int)
  const fileRow = await pool.query('SELECT user_id, size_bytes FROM files WHERE id=$1', [fileId]);
  const transferUserId = fileRow.rows[0]?.user_id;
  const transferSizeBytes = parseInt(fileRow.rows[0]?.size_bytes || '0', 10);
  const transfer = await checkAndIncrementTransfer(transferUserId, transferSizeBytes);
  if (!transfer.allowed) {
    const reason = `daily transfer limit reached: ${transfer.current} >= ${transfer.limit} bytes`;
    await pool.query(
      `UPDATE files SET status='error', error_reason=$2, updated_at=NOW() WHERE id=$1`,
      [fileId, reason]
    );
    log('warn', 'stage4: daily transfer limit reached', { file: rel, current: transfer.current, limit: transfer.limit });
    // Write admin notification
    await pool.query(
      `INSERT INTO admin_notifications (type, message, payload)
       VALUES ('transfer_limit', $1, $2)
       ON CONFLICT DO NOTHING`,
      [
        `Daily transfer limit reached for user ${transferUserId}`,
        JSON.stringify({ user_id: transferUserId, current_bytes: transfer.current, limit_bytes: transfer.limit, file: rel, date: new Date().toISOString().slice(0,10) })
      ]
    );
    return { ok: false, err: reason, duration: Date.now() - t0 };
  }

  // Mark syncing only after transfer check passes
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
      `UPDATE files SET status='error', error_reason=$2, retry_count=retry_count+1, updated_at=NOW() WHERE id=$1`, [fileId, `local hash failed: ${e.message}`]
    );
    logTransition(fileId, rel, 'syncing', 'error', `local hash failed: ${e.message}`, Date.now() - t0);
    return false;
  }

  // SFTP remotes do not support remote hashing - pipe remote file through sha256 locally
  // Validate remote path exists and capture exit code + stderr before trusting the hash
  const remotePath = `${RCLONE_DEST}/${rel}`;
  const { remoteHash, remoteErr } = await new Promise((resolve) => {
    const { spawn } = require("child_process");
    const rclone = spawn("rclone", ["cat", remotePath, "--log-level", "ERROR", "--contimeout", "10s", "--timeout", "30s"]);
    const hash = require("crypto").createHash("sha256");
    let stderrBuf = "";
    let stdoutBytes = 0;
    rclone.stdout.on("data", d => { hash.update(d); stdoutBytes += d.length; });
    rclone.stderr.on("data", d => { stderrBuf += d.toString(); });
    rclone.on("error", err => resolve({ remoteHash: null, remoteErr: err.message }));
    rclone.on("close", code => {
      if (code !== 0 || stdoutBytes === 0) {
        const reason = stderrBuf.trim() || `rclone cat exited with code ${code} — remote path may not exist`;
        resolve({ remoteHash: null, remoteErr: reason });
      } else {
        resolve({ remoteHash: hash.digest("hex"), remoteErr: null });
      }
    });
  });

  // If rclone cat failed, record the reason and bail — do not treat as hash mismatch
  if (remoteErr !== null) {
    await pool.query(
      `UPDATE files SET status='error', error_reason=$2, retry_count=retry_count+1, updated_at=NOW() WHERE id=$1`,
      [fileId, `stage5 rclone cat failed: ${remoteErr.slice(0, 200)}`]
    );
    logTransition(fileId, rel, 'syncing', 'error', `rclone cat failed: ${remoteErr.slice(0, 80)}`, Date.now() - t0);
    return false;
  }

  const duration = Date.now() - t0;

  if (localHash === remoteHash) {
    await pool.query(
      `UPDATE files SET status='synced', hash=$1, synced_at=NOW(), updated_at=NOW() WHERE id=$2`,
      [localHash, fileId]
    );
    logTransition(fileId, rel, 'syncing', 'synced', 'hash match', uploadDuration + duration);
    return true;
  } else {
    await pool.query(
      `UPDATE files SET status='error', error_reason=$2, retry_count=retry_count+1, updated_at=NOW() WHERE id=$1`, [fileId, `hash mismatch ${localHash?.slice(0,8)} vs ${remoteHash?.slice(0,8)}`]
    );
    logTransition(fileId, rel, 'syncing', 'error', `hash mismatch local=${localHash?.slice(0,8)} remote=${remoteHash?.slice(0,8)}`, duration);
    return false;
  }
}

// ── Stage 6: Resolve — detect conflict (both modified within 300s) ────────────
async function stage6Resolve(fileId, rel, filePath) {
  const row = await pool.query(
    `SELECT user_id, synced_at FROM files WHERE id=$1`, [fileId]
  );
  if (!row.rows.length) return;
  const { user_id, synced_at } = row.rows[0];
  if (!synced_at) return;

  // Conflict only if file was modified ON DISK after it was last synced
  let mtime = 0;
  try { mtime = require('fs').statSync(filePath).mtimeMs; } catch { return; }
  const syncedMs = new Date(synced_at).getTime();
  if (mtime <= syncedMs + 2000) return; // file not modified since sync, no conflict

  const existing = await pool.query(
    `SELECT id FROM conflicts WHERE file_path=$1 AND resolved=false LIMIT 1`, [rel]
  );
  if (existing.rows.length > 0) return;

  await pool.query(`UPDATE files SET status='conflict', updated_at=NOW() WHERE id=$1`, [fileId]);
  await pool.query(
    `INSERT INTO conflicts (user_id, file_path, detected_at) VALUES ($1, $2, NOW())`,
    [user_id, rel]
  );
  log('info', 'status transition', { file_id: fileId, file: rel, status_before: 'synced',
    status_after: 'conflict', reason: `mtime ${Math.round((mtime-syncedMs)/1000)}s after sync`, duration_ms: 0 });
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
        `UPDATE files SET status='error', error_reason=$2, retry_count=retry_count+1, updated_at=NOW() WHERE id=$1`, [fileId, upload.err]
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
    if (success) await stage6Resolve(fileId, rel, filePath);
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

// ── Exports for unit testing ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    stage1Detect,
    stage2Prioritise,
    stage3Check,
    stage4Upload,
    stage5Verify,
    stage6Resolve
  };
}
