'use strict';
require('dotenv').config({ path: '/app/.env' });

const chokidar  = require('chokidar');
const { execFile } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const WATCH_DIR   = process.env.SYNC_WATCH_DIR  || '/mnt/local';
const RCLONE_DEST = process.env.RCLONE_DEST     || 'goels:/srv/storage/remotes/parul-main/CacheFlow';
const MIN_AGE_MS  = parseInt(process.env.SYNC_MIN_AGE_MS || '1200000'); // 20 min
const EXCLUDE     = [/\.tmp$/, /\.lock$/, /\.part$/, /~$/];

const pending = new Map(); // path → settle timer

function log(level, msg, extra = {}) {
  process.stdout.write(JSON.stringify({
    ts: new Date().toISOString(), level, msg, ...extra
  }) + '\n');
}

function shouldSkip(filePath) {
  return EXCLUDE.some(re => re.test(filePath));
}

function ageOk(filePath) {
  try {
    const { mtimeMs } = fs.statSync(filePath);
    return (Date.now() - mtimeMs) >= MIN_AGE_MS;
  } catch { return false; }
}

function rcloneCopy(filePath) {
  // Compute destination path relative to watch dir
  const rel  = path.relative(WATCH_DIR, filePath);
  const dest = `${RCLONE_DEST}/${path.dirname(rel)}`;

  log('info', 'rclone copy start', { file: rel });
  execFile('rclone', [
    'copy', filePath, dest,
    '--checksum',
    '--transfers', '1',
    '--log-level', 'ERROR'
  ], (err, _stdout, stderr) => {
    if (err) {
      log('error', 'rclone copy failed', { file: rel, err: stderr.trim() });
    } else {
      log('info', 'rclone copy done', { file: rel });
    }
  });
}

function schedule(filePath) {
  if (shouldSkip(filePath)) return;

  // Debounce: reset timer each time file changes
  if (pending.has(filePath)) clearTimeout(pending.get(filePath));

  const delay = Math.max(0, MIN_AGE_MS - (Date.now() - (() => {
    try { return fs.statSync(filePath).mtimeMs; } catch { return Date.now(); }
  })()));

  const t = setTimeout(() => {
    pending.delete(filePath);
    if (!ageOk(filePath)) { schedule(filePath); return; }
    rcloneCopy(filePath);
  }, delay);

  pending.set(filePath, t);
}

log('info', 'sync worker starting', { watchDir: WATCH_DIR, minAgeMs: MIN_AGE_MS });

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
