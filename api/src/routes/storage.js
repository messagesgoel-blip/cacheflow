const express = require('express');
const pool = require('../db/client');
const authMw = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const fs = require('fs');
const path = require('path');

const router = express.Router();
router.use(authMw);

const LOCAL_PATH = process.env.LOCAL_CACHE_PATH || '/mnt/local';
const POOL_PATH = process.env.POOL_PATH || '/mnt/pool';
const LOCAL_DRIVE_NAME = process.env.LOCAL_DRIVE_NAME || 'NVMe Drive 1';
const POOL_DRIVE_NAME = process.env.POOL_DRIVE_NAME || 'NVMe Drive 2';

function parseJsonOrEmpty(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

// GET /storage/locations - Get storage locations and usage info
router.get('/locations', async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    // Get user's cloud configurations (no tenant_id in cloud_configs table)
    const cloudConfigs = await pool.query(
      `SELECT id, provider, config_json, is_active, created_at
       FROM cloud_configs
       WHERE user_id=$1
       ORDER BY is_active DESC, created_at DESC`,
      [userId]
    );

    // Calculate local cache usage
    let localCacheSize = 0;
    let localCacheFiles = 0;
    const localCachePath = path.join(LOCAL_PATH, userId);

    if (fs.existsSync(localCachePath)) {
      try {
        const files = await getDirectorySize(localCachePath);
        localCacheSize = files.totalSize;
        localCacheFiles = files.fileCount;
      } catch (err) {
        console.warn('[storage] Could not calculate local cache size:', err.message);
      }
    }

    // Calculate pool usage (read-only cache)
    let poolSize = 0;
    let poolFiles = 0;
    const poolUserPath = path.join(POOL_PATH, userId);

    if (fs.existsSync(poolUserPath)) {
      try {
        const files = await getDirectorySize(poolUserPath);
        poolSize = files.totalSize;
        poolFiles = files.fileCount;
      } catch (err) {
        console.warn('[storage] Could not calculate pool size:', err.message);
      }
    }

    // Get file status distribution from database
    const statusStats = await pool.query(
      `SELECT status, COUNT(*) as file_count, COALESCE(SUM(size_bytes), 0) as total_size
       FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       GROUP BY status`,
      [userId, tenantId]
    );

    // Get sync status summary
    const syncStats = await pool.query(
      `SELECT
         COUNT(*) as total_files,
         COUNT(CASE WHEN status = 'synced' THEN 1 END) as synced_files,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_files,
         COUNT(CASE WHEN status = 'syncing' THEN 1 END) as syncing_files,
         COUNT(CASE WHEN status = 'error' THEN 1 END) as error_files,
         COALESCE(SUM(size_bytes), 0) as total_size_bytes
       FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'`,
      [userId, tenantId]
    );

    const syncSummary = syncStats.rows[0];

    // Build response
    const locations = [
      {
        id: 'local-cache',
        name: LOCAL_DRIVE_NAME,
        type: 'local',
        path: LOCAL_PATH,
        totalSize: localCacheSize,
        fileCount: localCacheFiles,
        status: 'active',
        description: `Primary local storage (${LOCAL_PATH})`,
        color: 'blue',
        icon: '💾'
      },
      {
        id: 'readonly-pool',
        name: POOL_DRIVE_NAME,
        type: 'pool',
        path: POOL_PATH,
        totalSize: poolSize,
        fileCount: poolFiles,
        status: fs.existsSync(POOL_PATH) ? 'active' : 'unavailable',
        description: `Secondary pooled storage (${POOL_PATH})`,
        color: 'green',
        icon: '📚'
      }
    ];

    // Add cloud storage locations from configurations
    cloudConfigs.rows.forEach((config, index) => {
      const parsedConfig = parseJsonOrEmpty(config.config_json);
      const displayName = parsedConfig.displayName || `${config.provider} Cloud`;
      const region = parsedConfig.region || null;
      locations.push({
        id: `cloud-${config.id}`,
        name: displayName,
        type: 'cloud',
        provider: config.provider,
        region,
        isActive: config.is_active,
        status: config.is_active ? 'active' : 'inactive',
        description: region ? `Cloud storage in ${region}` : `Cloud storage on ${config.provider}`,
        color: index % 2 === 0 ? 'purple' : 'orange',
        icon: parsedConfig.icon || '☁️',
        configId: config.id,
        createdAt: config.created_at
      });
    });

    res.json({
      locations,
      summary: {
        totalFiles: parseInt(syncSummary.total_files, 10),
        syncedFiles: parseInt(syncSummary.synced_files, 10),
        pendingFiles: parseInt(syncSummary.pending_files, 10),
        syncingFiles: parseInt(syncSummary.syncing_files, 10),
        errorFiles: parseInt(syncSummary.error_files, 10),
        totalSizeBytes: parseInt(syncSummary.total_size_bytes, 10),
        localCacheSize,
        poolSize
      },
      statusBreakdown: statusStats.rows.map(row => ({
        status: row.status,
        fileCount: parseInt(row.file_count, 10),
        totalSize: parseInt(row.total_size, 10)
      }))
    });

  } catch (err) {
    console.error('[storage] locations:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /storage/usage - Detailed storage usage breakdown
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    // Get user quota info
    const userRes = await pool.query(
      `SELECT quota_bytes, used_bytes,
              quota_bytes - used_bytes AS available_bytes,
              ROUND((used_bytes::numeric / NULLIF(quota_bytes,0)) * 100, 2) AS used_pct
       FROM users WHERE id=$1 AND tenant_id=$2`,
      [userId, tenantId]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ error: 'user not found' });
    }

    const user = userRes.rows[0];

    // Get file size distribution by file type
    const fileTypes = await pool.query(
      `SELECT
         CASE
           WHEN path ~ '\.(pdf|docx?|txt|md|rtf)$' THEN 'Documents'
           WHEN path ~ '\.(jpg|jpeg|png|gif|bmp|svg|webp)$' THEN 'Images'
           WHEN path ~ '\.(mp4|avi|mov|mkv|webm|flv)$' THEN 'Videos'
           WHEN path ~ '\.(mp3|wav|flac|aac|ogg)$' THEN 'Audio'
           WHEN path ~ '\.(zip|tar|gz|rar|7z)$' THEN 'Archives'
           ELSE 'Other'
         END as file_type,
         COUNT(*) as file_count,
         COALESCE(SUM(size_bytes), 0) as total_size
       FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       GROUP BY 1
       ORDER BY total_size DESC`,
      [userId, tenantId]
    );

    // Get largest files
    const largestFiles = await pool.query(
      `SELECT id, path, size_bytes, status, created_at
       FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       ORDER BY size_bytes DESC
       LIMIT 10`,
      [userId, tenantId]
    );

    // Get oldest files
    const oldestFiles = await pool.query(
      `SELECT id, path, size_bytes, status, created_at
       FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       ORDER BY created_at ASC
       LIMIT 10`,
      [userId, tenantId]
    );

    res.json({
      quota: {
        total: parseInt(user.quota_bytes, 10),
        used: parseInt(user.used_bytes, 10),
        available: parseInt(user.available_bytes, 10),
        usedPercentage: parseFloat(user.used_pct || 0)
      },
      fileTypes: fileTypes.rows.map(row => ({
        type: row.file_type,
        fileCount: parseInt(row.file_count, 10),
        totalSize: parseInt(row.total_size, 10)
      })),
      largestFiles: largestFiles.rows.map(file => ({
        id: file.id,
        name: path.basename(file.path),
        path: file.path,
        sizeBytes: parseInt(file.size_bytes, 10),
        status: file.status,
        createdAt: file.created_at
      })),
      oldestFiles: oldestFiles.rows.map(file => ({
        id: file.id,
        name: path.basename(file.path),
        path: file.path,
        sizeBytes: parseInt(file.size_bytes, 10),
        status: file.status,
        createdAt: file.created_at
      }))
    });

  } catch (err) {
    console.error('[storage] usage:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Helper function to calculate directory size recursively
function getDirectorySize(dirPath) {
  return new Promise((resolve, reject) => {
    let totalSize = 0;
    let fileCount = 0;

    function walk(currentPath) {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            walk(itemPath);
          } else {
            totalSize += stat.size;
            fileCount++;
          }
        }
      } catch (err) {
        reject(err);
      }
    }

    try {
      if (fs.existsSync(dirPath)) {
        walk(dirPath);
        resolve({ totalSize, fileCount });
      } else {
        resolve({ totalSize: 0, fileCount: 0 });
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = router;
