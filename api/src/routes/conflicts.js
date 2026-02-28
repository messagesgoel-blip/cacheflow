const express = require('express');
const path = require('path');
const fs = require('fs');
const authMw  = require('../middleware/auth');
const pool = require('../db/client');
const { performAiMerge, SUPPORTED_MERGE_TYPES } = require('../services/aiMerge');

const router = express.Router();
router.use(authMw);

// GET /conflicts - list conflicts for user
router.get('/', async (req, res) => {
  try {
    // Prefer the current schema (user_id + tenant_id + resolved boolean + detected_at)
    try {
      const result = await pool.query(
        `SELECT id, file_path, local_version_url, cloud_version_url, resolved, resolution_type, detected_at, resolved_at
         FROM conflicts
         WHERE user_id=$1 AND tenant_id=$2 AND resolved=false
         ORDER BY detected_at DESC
         LIMIT 50`,
        [req.user.id, req.user.tenant_id]
      );
      const conflicts = (result.rows || []).map((c) => ({
        id: c.id,
        filename: path.basename(c.file_path || ''),
        detected_at: c.detected_at,
        status: c.resolved ? 'resolved' : 'unresolved',
        local_version_url: c.local_version_url,
        cloud_version_url: c.cloud_version_url,
      }));
      return res.json({ conflicts });
    } catch (e) {
      // Backward compatibility: older conflict schema (status-based) or missing table
      const code = e && (e.code || e?.cause?.code);
      if (code === '42P01') {
        // conflicts table missing
        return res.json({ conflicts: [] });
      }
      if (code === '42703') {
        // column missing — fallback to old schema
        const result = await pool.query(
          `SELECT id, file_id, local_hash, remote_hash, status, created_at, resolved_at
           FROM conflicts
           WHERE status != 'resolved'
           ORDER BY created_at DESC
           LIMIT 50`
        );
        const mapped = (result.rows || []).map((c) => ({
          id: c.id,
          filename: String(c.file_id || c.id),
          detected_at: c.created_at,
          status: c.status === 'resolved' ? 'resolved' : 'unresolved',
          local_hash: c.local_hash,
          remote_hash: c.remote_hash,
          resolved_at: c.resolved_at,
        }));
        return res.json({ conflicts: mapped });
      }
      throw e;
    }
  } catch (err) {
    console.error('[conflicts] list:', err.message);
    // Never 500 for normal users: return empty list
    res.json({ conflicts: [] });
  }
});

// GET /conflicts/:id - get single conflict
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM conflicts WHERE id = $1 AND user_id=$2 AND tenant_id=$3`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'conflict not found' });
    }
    const c = result.rows[0];
    res.json({
      conflict: {
        id: c.id,
        filename: path.basename(c.file_path || ''),
        detected_at: c.detected_at,
        status: c.resolved ? 'resolved' : 'unresolved',
        local_version_url: c.local_version_url,
        cloud_version_url: c.cloud_version_url,
      },
    });
  } catch (err) {
    console.error('[conflicts] get:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /conflicts/:id/resolve - resolve with manual choice
router.post('/:id/resolve', async (req, res) => {
  const { resolution } = req.body;
  if (!resolution || !['keep_local', 'keep_remote'].includes(resolution)) {
    return res.status(400).json({ error: 'resolution must be keep_local or keep_remote' });
  }

  try {
    // Get conflict
    const conflictResult = await pool.query(
      `SELECT * FROM conflicts WHERE id=$1 AND user_id=$2 AND tenant_id=$3`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );
    if (!conflictResult.rows.length) {
      return res.status(404).json({ error: 'conflict not found' });
    }

    const conflict = conflictResult.rows[0];
    const localPath = path.join(process.env.LOCAL_CACHE_PATH || '/mnt/local', req.user.id, conflict.file_path);
    const remotePath = path.join(process.env.POOL_PATH || '/mnt/pool', req.user.id, conflict.file_path);

    // Copy chosen version to replace the other
    let srcPath, destPath;
    if (resolution === 'keep_local') {
      srcPath = localPath;
      destPath = remotePath;
    } else {
      srcPath = remotePath;
      destPath = localPath;
    }

    // Verify source exists
    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: `Source file not found: ${srcPath}` });
    }

    // Copy file (overwrite destination)
    fs.copyFileSync(srcPath, destPath);

    // Update conflict status
    await pool.query(
      `UPDATE conflicts SET resolved=true, resolved_at=NOW(), resolution_type=$1 WHERE id=$2 AND user_id=$3 AND tenant_id=$4`,
      [resolution, req.params.id, req.user.id, req.user.tenant_id]
    );

    res.json({ success: true, resolution, note: `Copied ${resolution} to replace other version` });
  } catch (err) {
    console.error('[conflicts] resolve:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /conflicts/:id/ai-merge - AI-powered merge
router.post('/:id/ai-merge', async (req, res) => {
  const { model } = req.body;

  try {
    // Get conflict (current schema)
    const conflictResult = await pool.query(
      `SELECT * FROM conflicts WHERE id=$1 AND user_id=$2 AND tenant_id=$3`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );

    if (!conflictResult.rows.length) {
      return res.status(404).json({ error: 'conflict not found' });
    }

    const conflict = conflictResult.rows[0];
    const ext = path.extname(conflict.file_path).toLowerCase();

    // Check file type is supported
    if (!SUPPORTED_MERGE_TYPES[ext]) {
      return res.status(422).json({ error: `AI merge not supported for ${ext} files` });
    }

    // Get local and remote file paths
    const localPath = path.join(process.env.LOCAL_CACHE_PATH || '/mnt/local', req.user.id, conflict.file_path);
    const remotePath = path.join(process.env.POOL_PATH || '/mnt/pool', req.user.id, conflict.file_path);

    // Verify files exist
    if (!fs.existsSync(localPath) || !fs.existsSync(remotePath)) {
      return res.status(404).json({ error: 'Local or remote file not found' });
    }

    const localContent = fs.readFileSync(localPath, 'utf8');
    const remoteContent = fs.readFileSync(remotePath, 'utf8');

    const { mergedContent, mergeType } = await performAiMerge(
      localContent, remoteContent, ext, model
    );

    // Only DB write: update conflict status (no content stored)
    await pool.query(
      `UPDATE conflicts SET resolved=true, resolved_at=NOW(), resolution_type=$1 WHERE id=$2 AND user_id=$3 AND tenant_id=$4`,
      [`ai_merged:${mergeType}:${model || 'default'}`, conflict.id, req.user.id, req.user.tenant_id]
    );
    // ZERO-RETENTION: plaintext never persisted — audit compliance

    return res.json({ merged_content: mergedContent, merge_type: mergeType, model });
  } catch (err) {
    console.error('[conflicts] ai-merge:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
