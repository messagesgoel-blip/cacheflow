const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const pool     = require('../db/client');
const authMw   = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

const LOCAL_PATH = process.env.LOCAL_CACHE_PATH || '/mnt/local';
const POOL_PATH  = process.env.POOL_PATH        || '/mnt/pool';
const MAX_MB     = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(LOCAL_PATH, req.user.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, path.basename(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: MAX_MB * 1024 * 1024 } });

function fileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end',  () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// GET /files
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, path, size_bytes, hash, status, error_reason, retry_count, last_modified, synced_at, created_at
       FROM files WHERE user_id=$1 AND status != 'deleted' ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ files: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[files] list:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /files/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const relativePath = req.query.path
    ? path.normalize(req.query.path).replace(/^(\.\.(\/|\\|$))+/, '')
    : req.file.originalname;
  const diskPath = path.join(LOCAL_PATH, req.user.id, relativePath);
  if (relativePath !== req.file.originalname) {
    fs.mkdirSync(path.dirname(diskPath), { recursive: true });
    fs.renameSync(req.file.path, diskPath);
  }
  try {
    // Quota check — reject if this upload would exceed the user's quota
    const quotaRes = await pool.query(
      `SELECT quota_bytes, used_bytes FROM users WHERE id=$1`, [req.user.id]
    );
    const quota_bytes = parseInt(quotaRes.rows[0].quota_bytes, 10);
    const used_bytes  = parseInt(quotaRes.rows[0].used_bytes,  10);
    if (used_bytes + req.file.size > quota_bytes) {
      fs.unlink(diskPath, () => {});
      return res.status(413).json({
        error: 'Quota exceeded',
        quota_bytes,
        used_bytes,
        file_size: req.file.size,
        available_bytes: quota_bytes - used_bytes
      });
    }

    const hash = await fileHash(relativePath !== req.file.originalname ? diskPath : req.file.path);
    const result = await pool.query(
      `INSERT INTO files (user_id, path, size_bytes, hash, status, last_modified)
       VALUES ($1,$2,$3,$4,'pending',NOW())
       ON CONFLICT (user_id, path)
       DO UPDATE SET size_bytes=$3, hash=$4, status='pending', last_modified=NOW(), synced_at=NULL
       RETURNING *`,
      [req.user.id, relativePath, req.file.size, hash]
    );
    // Increment used_bytes (on conflict, adjust for size difference)
    await pool.query(
      `UPDATE users SET used_bytes = used_bytes + $1 WHERE id = $2`,
      [req.file.size, req.user.id]
    );
    res.status(201).json({ file: result.rows[0] });
  } catch (err) {
    console.error('[files] upload:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /files/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT path, size_bytes FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    const file = result.rows[0];
    const poolPath  = path.join(POOL_PATH,  req.user.id, file.path);
    const localPath = path.join(LOCAL_PATH, req.user.id, file.path);
    const diskPath  = fs.existsSync(poolPath) ? poolPath : localPath;
    if (!fs.existsSync(diskPath))
      return res.status(404).json({ error: 'file not on disk — sync may be pending' });
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file.path)}"`);
    res.setHeader('Content-Length', file.size_bytes);
    fs.createReadStream(diskPath).pipe(res);
  } catch (err) {
    console.error('[files] download:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /files/:id
router.patch('/:id', async (req, res) => {
  const { path: newPath, status, synced_at, hash } = req.body;
  try {
    // DB update first — if it fails (e.g. unique constraint), disk is never touched
    const result = await pool.query(
      `UPDATE files SET
         path=COALESCE($1,path), status=COALESCE($2,status),
         synced_at=COALESCE($3::timestamptz,synced_at), hash=COALESCE($4,hash)
       WHERE id=$5 AND user_id=$6 AND status != 'deleted' RETURNING *, (SELECT path FROM files WHERE id=$5) AS old_path`,
      [newPath, status, synced_at, hash, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    // Disk rename only after DB succeeds
    if (newPath) {
      const oldPath = result.rows[0].old_path;
      const oldDisk = path.join(LOCAL_PATH, req.user.id, oldPath);
      const newDisk = path.join(LOCAL_PATH, req.user.id, newPath);
      if (fs.existsSync(oldDisk)) {
        fs.mkdirSync(path.dirname(newDisk), { recursive: true });
        fs.renameSync(oldDisk, newDisk);
      }
    }
    res.json({ file: result.rows[0] });
  } catch (err) {
    console.error('[files] patch:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /files/:id (soft)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE files SET status='deleted' WHERE id=$1 AND user_id=$2 AND status != 'deleted' RETURNING id, size_bytes`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    // Decrement used_bytes on soft delete
    await pool.query(
      `UPDATE users SET used_bytes = GREATEST(0, used_bytes - $1) WHERE id = $2`,
      [result.rows[0].size_bytes, req.user.id]
    );
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    console.error('[files] delete:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /files/:id/share
router.post('/:id/share', async (req, res) => {
  const { password, expires_in_hours, max_downloads } = req.body;
  try {
    const fileRes = await pool.query(
      `SELECT id FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [req.params.id, req.user.id]
    );
    if (!fileRes.rows.length) return res.status(404).json({ error: 'file not found' });
    const token         = crypto.randomBytes(32).toString('hex');
    const password_hash = password ? await bcrypt.hash(password, 12) : null;
    const expires_at    = expires_in_hours
      ? new Date(Date.now() + expires_in_hours * 3600 * 1000) : null;
    const result = await pool.query(
      `INSERT INTO shared_links (file_id, token, password_hash, expires_at, max_downloads, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, token, expires_at, max_downloads, created_at`,
      [req.params.id, token, password_hash, expires_at, max_downloads || null, req.user.id]
    );
    const link = result.rows[0];
    res.status(201).json({
      share_url: `/share/${link.token}`,
      token: link.token,
      expires_at: link.expires_at,
      max_downloads: link.max_downloads,
      password_protected: !!password
    });
  } catch (err) {
    console.error('[share] create:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /files/:id/retry — reset error → pending so worker picks it up again
const MAX_RETRY_COUNT = 10;
router.post('/:id/retry', async (req, res) => {
  try {
    // First check if file exists at all
    const check = await pool.query(
      `SELECT id, status, retry_count FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [req.params.id, req.user.id]
    );
    if (!check.rows.length)
      return res.status(404).json({ error: 'File not found' });

    const file = check.rows[0];

    // 409 if not in error state
    if (file.status !== 'error')
      return res.status(409).json({ error: `Cannot retry file with status '${file.status}'` });

    // 409 if retry cap exceeded
    if (file.retry_count >= MAX_RETRY_COUNT)
      return res.status(409).json({ error: `Retry limit reached (${MAX_RETRY_COUNT}). Manual intervention required.` });

    const result = await pool.query(
      `UPDATE files
       SET status='pending', error_reason=NULL, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING id, path, status, retry_count`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Queued for retry', file: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /files/usage — storage usage for current user
router.get('/usage', async (req, res) => {
  try {
    const usage = await pool.query(
      `SELECT quota_bytes, used_bytes,
              quota_bytes - used_bytes AS available_bytes,
              ROUND((used_bytes::numeric / NULLIF(quota_bytes,0)) * 100, 2) AS used_pct
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    const counts = await pool.query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(size_bytes),0) AS total_bytes
       FROM files WHERE user_id=$1 AND status != 'deleted'
       GROUP BY status`,
      [req.user.id]
    );
    const row = usage.rows[0];
    res.json({
      quota_bytes:     parseInt(row.quota_bytes, 10),
      used_bytes:      parseInt(row.used_bytes, 10),
      available_bytes: parseInt(row.available_bytes, 10),
      used_pct:        parseFloat(row.used_pct || 0),
      files:           counts.rows.reduce((acc, r) => {
        acc[r.status] = { count: parseInt(r.count, 10), bytes: parseInt(r.total_bytes, 10) };
        return acc;
      }, {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
