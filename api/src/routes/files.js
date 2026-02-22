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
    const hash = await fileHash(relativePath !== req.file.originalname ? diskPath : req.file.path);
    const result = await pool.query(
      `INSERT INTO files (user_id, path, size_bytes, hash, status, last_modified)
       VALUES ($1,$2,$3,$4,'pending',NOW())
       ON CONFLICT (user_id, path)
       DO UPDATE SET size_bytes=$3, hash=$4, status='pending', last_modified=NOW(), synced_at=NULL
       RETURNING *`,
      [req.user.id, relativePath, req.file.size, hash]
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
    if (newPath) {
      const cur = await pool.query(
        `SELECT path FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
        [req.params.id, req.user.id]
      );
      if (!cur.rows.length) return res.status(404).json({ error: 'file not found' });
      const oldDisk = path.join(LOCAL_PATH, req.user.id, cur.rows[0].path);
      const newDisk = path.join(LOCAL_PATH, req.user.id, newPath);
      if (fs.existsSync(oldDisk)) {
        fs.mkdirSync(path.dirname(newDisk), { recursive: true });
        fs.renameSync(oldDisk, newDisk);
      }
    }
    const result = await pool.query(
      `UPDATE files SET
         path=COALESCE($1,path), status=COALESCE($2,status),
         synced_at=COALESCE($3::timestamptz,synced_at), hash=COALESCE($4,hash)
       WHERE id=$5 AND user_id=$6 AND status != 'deleted' RETURNING *`,
      [newPath, status, synced_at, hash, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
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
      `UPDATE files SET status='deleted' WHERE id=$1 AND user_id=$2 AND status != 'deleted' RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
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

module.exports = router;

// POST /files/:id/retry — reset error → pending so worker picks it up again
router.post('/:id/retry', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE files
       SET status='pending', error_reason=NULL, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='error'
       RETURNING id, path, status`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'File not found or not in error state' });
    }
    res.json({ message: 'Queued for retry', file: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
