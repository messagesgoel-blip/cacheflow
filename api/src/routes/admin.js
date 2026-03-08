const express = require('express');
const pool = require('../db/client');
const authMw = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMw);

// Middleware to check admin
async function requireAdmin(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// POST /admin/files/:id/lock
// Lock a file with retention period
router.post('/files/:id/lock', requireAdmin, async (req, res) => {
  const fileId = req.params.id;
  const { retention_days } = req.body;

  // Validate retention_days
  if (!retention_days || retention_days < 1 || retention_days > 3650) {
    return res.status(400).json({ error: 'retention_days must be between 1 and 3650' });
  }

  try {
    const immutableUntil = new Date(Date.now() + retention_days * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE files SET immutable_until = $1, immutable_set_by = $2 WHERE id = $3`,
      [immutableUntil, req.user.id, fileId]
    );

    res.json({ immutable_until: immutableUntil });

    // Audit log lock (non-blocking)
    auditLog(req.user.id, 'lock', 'file', fileId, req, { retention_days }).catch(() => {});
  } catch (err) {
    console.error('[admin] lock error:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /admin/files/:id/lock
// Unlock (admin override)
router.delete('/files/:id/lock', requireAdmin, async (req, res) => {
  const fileId = req.params.id;

  try {
    await pool.query(
      `UPDATE files SET immutable_until = NULL, immutable_set_by = NULL WHERE id = $1`,
      [fileId]
    );

    res.json({ success: true });

    // Audit log unlock (non-blocking)
    auditLog(req.user.id, 'unlock', 'file', fileId, req).catch(() => {});
  } catch (err) {
    console.error('[admin] unlock error:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /admin/stats
// Returns admin statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Get total users
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersResult.rows[0]?.count || '0', 10);

    // Get total files
    const filesResult = await pool.query('SELECT COUNT(*) as count FROM files');
    const totalFiles = parseInt(filesResult.rows[0]?.count || '0', 10);

    // Get total storage used
    const storageResult = await pool.query('SELECT COALESCE(SUM(size_bytes), 0) as total FROM files');
    const storageUsedBytes = parseInt(storageResult.rows[0]?.total || '0', 10);

    // Get daily transfer (last 24 hours) if table exists
    let dailyTransferBytes = 0;
    try {
      const transferResult = await pool.query(
        `SELECT COALESCE(SUM(bytes_transferred), 0) as total
         FROM transfer_logs
         WHERE created_at > NOW() - INTERVAL '24 hours'`
      );
      dailyTransferBytes = parseInt(transferResult.rows[0]?.total || '0', 10);
    } catch (e) {
      const code = e && (e.code || e?.cause?.code);
      if (code !== '42P01' && code !== '42703') throw e;
      dailyTransferBytes = 0;
    }

    res.json({
      total_users: totalUsers,
      total_files: totalFiles,
      storage_used_bytes: storageUsedBytes,
      daily_transfer_bytes: dailyTransferBytes
    });
  } catch (err) {
    console.error('[admin] stats error:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /admin/transfer-stats
// Returns daily transfer (last 7 days) in GB
router.get('/transfer-stats', requireAdmin, async (req, res) => {
  try {
    // If transfer_logs isn't present, return stable placeholder
    let rows = [];
    try {
      const r = await pool.query(
        `SELECT to_char(date_trunc('day', created_at), 'Mon DD') as date,
                COALESCE(SUM(bytes_transferred), 0) as bytes
         FROM transfer_logs
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY 1
         ORDER BY MIN(created_at) ASC`
      );
      rows = r.rows || [];
    } catch (e) {
      const code = e && (e.code || e?.cause?.code);
      if (code !== '42P01' && code !== '42703') throw e;
      rows = [];
    }

    const data = rows.map((x) => ({
      date: x.date,
      transfer_gb: Number((Number(x.bytes || 0) / (1024 * 1024 * 1024)).toFixed(1)),
    }));

    return res.json({ data });
  } catch (err) {
    console.error('[admin] transfer-stats error:', err.message);
    res.json({ data: [] });
  }
});

// GET /admin/storage-breakdown
// Returns storage by status in GB
router.get('/storage-breakdown', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT status, COALESCE(SUM(size_bytes), 0) AS bytes
       FROM files
       WHERE status != 'deleted'
       GROUP BY status`
    );

    const out = { synced: 0, pending: 0, error: 0 };
    for (const row of (result.rows || [])) {
      const status = String(row.status || '').toLowerCase();
      const gb = Number((Number(row.bytes || 0) / (1024 * 1024 * 1024)).toFixed(1));
      if (status === 'synced') out.synced += gb;
      else if (status === 'pending') out.pending += gb;
      else if (status === 'error') out.error += gb;
    }

    return res.json(out);
  } catch (err) {
    const code = err && (err.code || err?.cause?.code);
    if (code === '42P01' || code === '42703') {
      return res.json({ synced: 0, pending: 0, error: 0 });
    }
    console.error('[admin] storage-breakdown error:', err.message);
    res.json({ synced: 0, pending: 0, error: 0 });
  }
});

// GET /admin/audit
// Returns audit logs (admin only)
router.get('/audit', requireAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const userId = req.query.user_id;
  const action = req.query.action;

  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (userId) {
      query += ` AND user_id = $${paramCount++}`;
      params.push(userId);
    }
    if (action) {
      query += ` AND action = $${paramCount++}`;
      params.push(action);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + paramCount++ + ' OFFSET $' + paramCount++;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({ audit_logs: result.rows, limit, offset });
  } catch (err) {
    console.error('[admin] audit:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;

