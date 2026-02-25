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
    const result = await pool.query(
      `SELECT id, file_id, local_hash, remote_hash, status, created_at, resolved_at
       FROM conflicts
       WHERE status != 'resolved'
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json({ conflicts: result.rows });
  } catch (err) {
    console.error('[conflicts] list:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /conflicts/:id - get single conflict
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM conflicts WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'conflict not found' });
    }
    res.json({ conflict: result.rows[0] });
  } catch (err) {
    console.error('[conflicts] get:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /conflicts/:id/resolve - resolve with manual choice
router.post('/:id/resolve', async (req, res) => {
  const { resolution, keep_local } = req.body;
  if (!resolution || !['keep_local', 'keep_remote'].includes(resolution)) {
    return res.status(400).json({ error: 'resolution must be keep_local or keep_remote' });
  }

  try {
    // Get conflict
    const conflict = await pool.query('SELECT * FROM conflicts WHERE id = $1', [req.params.id]);
    if (!conflict.rows.length) {
      return res.status(404).json({ error: 'conflict not found' });
    }

    // TODO: Actually replace the file content based on resolution
    // For now, just mark as resolved
    await pool.query(
      `UPDATE conflicts SET status='resolved', resolved_at=NOW(), resolution=$1 WHERE id=$2`,
      [resolution, req.params.id]
    );

    res.json({ success: true, resolution });
  } catch (err) {
    console.error('[conflicts] resolve:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /conflicts/:id/ai-merge - AI-powered merge
router.post('/:id/ai-merge', async (req, res) => {
  const { model } = req.body;

  try {
    // Get conflict with file paths
    const conflictResult = await pool.query(
      `SELECT c.*, f.path as file_path, f.user_id
       FROM conflicts c
       JOIN files f ON f.id = c.file_id
       WHERE c.id = $1 AND f.user_id = $2`,
      [req.params.id, req.user.id]
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
    const localPath = path.join(process.env.LOCAL_CACHE_PATH || '/mnt/local', conflict.file_path);
    const remotePath = path.join(process.env.POOL_PATH || '/mnt/pool', conflict.file_path);

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
      `UPDATE conflicts SET status='ai_merged', resolved_at=NOW(), resolution_model=$1, resolution_type=$2 WHERE id=$3`,
      [model, mergeType, conflict.id]
    );
    // ZERO-RETENTION: plaintext never persisted — audit compliance

    return res.json({ merged_content: mergedContent, merge_type: mergeType, model });
  } catch (err) {
    console.error('[conflicts] ai-merge:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
