const express = require('express');
const { pool } = require('../db/client');
const authMw = require('../middleware/auth');

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
  } catch (err) {
    console.error('[admin] unlock error:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
