const express = require('express');
const pool    = require('../db/client');
const authMw  = require('../middleware/auth');

const router = express.Router();
router.use(authMw);  // all file routes require valid JWT

// GET /files — list files for authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, path, size_bytes, hash, status, last_modified, synced_at, created_at
       FROM files WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ files: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[files] list:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /files — register/upsert file metadata
router.post('/', async (req, res) => {
  const { path, size_bytes, hash, status = 'pending', last_modified } = req.body;
  if (!path || size_bytes == null) {
    return res.status(400).json({ error: 'path and size_bytes required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO files (user_id, path, size_bytes, hash, status, last_modified)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, path)
       DO UPDATE SET size_bytes=$3, hash=$4, status=$5, last_modified=$6, synced_at=NULL
       RETURNING *`,
      [req.user.id, path, size_bytes, hash || null, status, last_modified || null]
    );
    res.status(201).json({ file: result.rows[0] });
  } catch (err) {
    console.error('[files] create:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /files/:id — update status / synced_at / hash
router.patch('/:id', async (req, res) => {
  const { status, synced_at, hash } = req.body;
  try {
    const result = await pool.query(
      `UPDATE files SET
         status    = COALESCE($1, status),
         synced_at = COALESCE($2::timestamptz, synced_at),
         hash      = COALESCE($3, hash)
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [status, synced_at, hash, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    res.json({ file: result.rows[0] });
  } catch (err) {
    console.error('[files] patch:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /files/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM files WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    console.error('[files] delete:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
