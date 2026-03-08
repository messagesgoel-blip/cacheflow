'use strict';

function asPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[worker config] ${name} must be a positive integer`);
  }
  return parsed;
}

function requireDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'postgres://cacheflow:cacheflow@localhost:5432/cacheflow_test';
  }
  throw new Error('[worker config] Missing required environment variable: DATABASE_URL');
}

module.exports = {
  databaseUrl: requireDatabaseUrl(),
  redisHost: process.env.REDIS_HOST || 'cacheflow-redis',
  redisPort: asPositiveInt('REDIS_PORT', 6379),
  dailyTransferLimitBytes: asPositiveInt('DAILY_TRANSFER_LIMIT_BYTES', 750 * 1024 * 1024 * 1024),
  watchDir: process.env.SYNC_WATCH_DIR || '/mnt/local',
  rcloneDest: process.env.RCLONE_DEST || 'goels:/srv/storage/remotes/parul-main/CacheFlow',
  rcloneDestOverflow: process.env.RCLONE_DEST_OVERFLOW || 'goels-overflow:/srv/storage/remotes/parul-main/CacheFlow',
  syncMinAgeMs: asPositiveInt('SYNC_MIN_AGE_MS', 1200000),
  maxConcurrentFiles: asPositiveInt('MAX_CONCURRENT_FILES', 5),
  staleSyncingSweepMs: asPositiveInt('STALE_SYNCING_SWEEP_MS', 120000),
  syncPerfLogIntervalMs: asPositiveInt('SYNC_PERF_LOG_INTERVAL_MS', 30000)
};

