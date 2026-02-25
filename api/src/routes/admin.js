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
