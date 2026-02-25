const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const pool     = require('../db/client');
const authMw   = require('../middleware/auth');
const { generateEmbeddingForFile } = require('../services/embeddings');
const { auditLog } = require('../middleware/audit');

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
      `SELECT id, path, size_bytes, hash, status, error_reason, retry_count, last_modified, synced_at, created_at, immutable_until
       FROM files WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted' ORDER BY created_at DESC`,
      [req.user.id, req.user.tenant_id]
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
      `SELECT quota_bytes, used_bytes FROM users WHERE id=$1 AND tenant_id=$2`, [req.user.id, req.user.tenant_id]
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
    const fileId = result.rows[0].id;
    res.status(201).json({ file: result.rows[0] });

    // Audit log upload (fire-and-forget, non-blocking)
    auditLog(req.user.id, 'upload', 'file', fileId, req, { size_bytes: req.file.size, path: relativePath }).catch(() => {});

    // Fire-and-forget: generate embedding in background
    generateEmbeddingForFile(fileId, diskPath, req.file.mimetype).catch(err => {
      console.error('[files] Background embedding failed:', err.message);
    });
  } catch (err) {
    console.error('[files] upload:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /files/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT path, size_bytes FROM files WHERE id=$1 AND user_id=$2 AND tenant_id=$3 AND status != 'deleted'`,
      [req.params.id, req.user.id, req.user.tenant_id]
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

    // Audit log download (non-blocking)
    res.on('finish', () => {
      auditLog(req.user.id, 'download', 'file', req.params.id, req, { size_bytes: file.size_bytes }).catch(() => {});
    });
  } catch (err) {
    console.error('[files] download:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /files/:id
router.patch('/:id', async (req, res) => {
  const { path: newPath, status, synced_at, hash } = req.body;
  try {
    // Fetch old path BEFORE update for disk rename
    const existing = await pool.query(
      `SELECT path FROM files WHERE id=$1 AND user_id=$2 AND tenant_id=$3 AND status != 'deleted'`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'file not found' });
    const oldPath = existing.rows[0].path;
    // DB update first — if it fails (e.g. unique constraint), disk is never touched
    const result = await pool.query(
      `UPDATE files SET
         path=COALESCE($1,path), status=COALESCE($2,status),
         synced_at=COALESCE($3::timestamptz,synced_at), hash=COALESCE($4,hash)
       WHERE id=$5 AND user_id=$6 AND tenant_id=$7 AND status != 'deleted' RETURNING *`,
      [newPath, status, synced_at, hash, req.params.id, req.user.id, req.user.tenant_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    // Disk rename only after DB succeeds
    if (newPath) {
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
    // Check if file is immutable
    const immutabilityCheck = await pool.query(
      `SELECT immutable_until FROM files WHERE id=$1 AND user_id=$2 AND tenant_id=$3`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );

    if (immutabilityCheck.rows.length > 0 && immutabilityCheck.rows[0].immutable_until) {
      const immutableUntil = new Date(immutabilityCheck.rows[0].immutable_until);
      if (immutableUntil > new Date()) {
        return res.status(403).json({
          error: 'File is immutable',
          immutable_until: immutableUntil.toISOString()
        });
      }
    }

    const result = await pool.query(
      `UPDATE files SET status='deleted' WHERE id=$1 AND user_id=$2 AND tenant_id=$3 AND status != 'deleted' RETURNING id, size_bytes`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'file not found' });
    // Decrement used_bytes on soft delete
    await pool.query(
      `UPDATE users SET used_bytes = GREATEST(0, used_bytes - $1) WHERE id = $2`,
      [result.rows[0].size_bytes, req.user.id]
    );
    res.json({ deleted: true, id: result.rows[0].id });

    // Audit log delete (non-blocking)
    auditLog(req.user.id, 'delete', 'file', req.params.id, req, { size_bytes: result.rows[0].size_bytes }).catch(() => {});
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

    // Audit log share (non-blocking)
    auditLog(req.user.id, 'share', 'file', req.params.id, req, { expires_in_hours, max_downloads, password_protected: !!password }).catch(() => {});
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
       FROM users WHERE id=$1 AND tenant_id=$2`,
      [req.user.id, req.user.tenant_id]
    );
    const counts = await pool.query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(size_bytes),0) AS total_bytes
       FROM files WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       GROUP BY status`,
      [req.user.id, req.user.tenant_id]
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

// GET /files/browse - Browse files and folders at a specific path
router.get('/browse', async (req, res) => {
  try {
    const requestedPath = req.query.path || '/';
    const normalizedPath = requestedPath === '/' ? '' : requestedPath.replace(/^\/+|\/+$/g, '');
    const locationId = typeof req.query.location === 'string' ? req.query.location : 'local-cache';

    // Get all files for this user
    const result = await pool.query(
      `SELECT id, path, size_bytes, hash, status, error_reason, retry_count,
              last_modified, synced_at, created_at, immutable_until
       FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'`,
      [req.user.id, req.user.tenant_id]
    );

    let allFiles = result.rows;

    // NOTE: Location-based filtering by disk existence is too strict -
    // files may exist in one location but the check fails for others.
    // For now, show all files regardless of location selection.
    // TODO: Add location metadata to files table for proper filtering.

    // Extract folders and files at the current path level
    const folders = new Set();
    const filesAtPath = [];

    for (const file of allFiles) {
      const filePath = file.path;

      // Check if file is at the current path or in a subdirectory
      if (normalizedPath === '' || filePath.startsWith(normalizedPath + '/')) {
        // Remove the current path prefix
        const relativePath = normalizedPath === '' ? filePath : filePath.substring(normalizedPath.length + 1);

        // Split into components
        const parts = relativePath.split('/').filter(p => p !== '');

        if (parts.length === 0) {
          // This shouldn't happen for valid paths
          continue;
        } else if (parts.length === 1) {
          if (file.hash === 'folder-marker') continue;
          // File at current path
          filesAtPath.push({
            ...file,
            name: parts[0],
            isFolder: false
          });
        } else {
          // File in subfolder - add first part as folder
          folders.add(parts[0]);
        }
      }
    }

    // Convert folders set to array
    const folderArray = Array.from(folders).map(folderName => ({
      name: folderName,
      path: normalizedPath === '' ? folderName : `${normalizedPath}/${folderName}`,
      isFolder: true,
      itemCount: allFiles.filter(f => {
        if (f.hash === 'folder-marker') return false;
        const filePath = f.path;
        if (normalizedPath === '') {
          return filePath.startsWith(folderName + '/');
        } else {
          return filePath.startsWith(`${normalizedPath}/${folderName}/`);
        }
      }).length
    }));

    res.json({
      path: requestedPath,
      location: locationId,
      folders: folderArray,
      files: filesAtPath,
      totalItems: folderArray.length + filesAtPath.length
    });

  } catch (err) {
    console.error('[files] browse:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /files/folders - Create a new folder
router.post('/folders', async (req, res) => {
  try {
    const { path: folderPath } = req.body;

    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ error: 'folder path required' });
    }

    // Normalize path and ensure it doesn't have trailing slash
    const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');

    if (normalizedPath === '') {
      return res.status(400).json({ error: 'invalid folder path' });
    }

    // Check if folder already exists (has files in it)
    const existingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       AND path LIKE $3 || '/%'`,
      [req.user.id, req.user.tenant_id, normalizedPath]
    );

    if (parseInt(existingCheck.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: 'folder already exists' });
    }

    // Create a dummy file to represent the folder
    // This ensures the folder appears in listings and can be managed
    const dummyFilePath = `${normalizedPath}/.folder-marker`;
    const result = await pool.query(
      `INSERT INTO files (user_id, tenant_id, path, size_bytes, hash, status)
       VALUES ($1, $2, $3, 0, 'folder-marker', 'synced')
       ON CONFLICT (user_id, path) DO NOTHING
       RETURNING id, path, created_at`,
      [req.user.id, req.user.tenant_id, dummyFilePath]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'folder already exists' });
    }

    // Create the folder on disk
    const folderDiskPath = path.join(LOCAL_PATH, req.user.id, normalizedPath);
    fs.mkdirSync(folderDiskPath, { recursive: true });

    // Also create in pool path if it exists
    const poolFolderPath = path.join(POOL_PATH, req.user.id, normalizedPath);
    if (fs.existsSync(path.dirname(poolFolderPath))) {
      fs.mkdirSync(poolFolderPath, { recursive: true });
    }

    res.status(201).json({
      folder: {
        path: normalizedPath,
        created: true
      }
    });

    // Audit log folder creation
    auditLog(req.user.id, 'create', 'folder', null, req, { path: normalizedPath }).catch(() => {});

  } catch (err) {
    console.error('[files] create folder:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /files/folders - Delete an empty folder
router.delete('/folders', async (req, res) => {
  try {
    const { path: folderPath } = req.query;

    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ error: 'folder path required' });
    }

    // Normalize path
    const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');

    if (normalizedPath === '') {
      return res.status(400).json({ error: 'cannot delete root folder' });
    }

    // Check if folder contains any files
    const filesCheck = await pool.query(
      `SELECT COUNT(*) as count FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND status != 'deleted'
       AND path LIKE $3 || '/%'`,
      [req.user.id, req.user.tenant_id, normalizedPath]
    );

    const fileCount = parseInt(filesCheck.rows[0].count, 10);

    if (fileCount > 0) {
      return res.status(409).json({
        error: 'folder not empty',
        fileCount,
        message: `Folder contains ${fileCount} file(s). Delete files first or use force delete.`
      });
    }

    // Delete the folder marker file if it exists
    await pool.query(
      `DELETE FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND path=$3 AND hash='folder-marker'`,
      [req.user.id, req.user.tenant_id, `${normalizedPath}/.folder-marker`]
    );

    // Remove folder from disk
    const folderDiskPath = path.join(LOCAL_PATH, req.user.id, normalizedPath);
    if (fs.existsSync(folderDiskPath)) {
      fs.rmdirSync(folderDiskPath);
    }

    // Also remove from pool path if it exists
    const poolFolderPath = path.join(POOL_PATH, req.user.id, normalizedPath);
    if (fs.existsSync(poolFolderPath)) {
      fs.rmdirSync(poolFolderPath);
    }

    res.json({
      deleted: true,
      path: normalizedPath
    });

    // Audit log folder deletion
    auditLog(req.user.id, 'delete', 'folder', null, req, { path: normalizedPath }).catch(() => {});

  } catch (err) {
    console.error('[files] delete folder:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /files/:id/move - Move a file or folder to a new location
router.patch('/:id/move', async (req, res) => {
  try {
    const { newPath } = req.body;

    if (!newPath || typeof newPath !== 'string') {
      return res.status(400).json({ error: 'new path required' });
    }

    // Get the file to move
    const fileResult = await pool.query(
      `SELECT id, path, size_bytes FROM files
       WHERE id=$1 AND user_id=$2 AND tenant_id=$3 AND status != 'deleted'`,
      [req.params.id, req.user.id, req.user.tenant_id]
    );

    if (!fileResult.rows.length) {
      return res.status(404).json({ error: 'file not found' });
    }

    const file = fileResult.rows[0];
    const oldPath = file.path;

    // Check if new path already exists
    const existingCheck = await pool.query(
      `SELECT id FROM files
       WHERE user_id=$1 AND tenant_id=$2 AND path=$3 AND status != 'deleted'`,
      [req.user.id, req.user.tenant_id, newPath]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ error: 'destination already exists' });
    }

    // Update the file path in database
    const updateResult = await pool.query(
      `UPDATE files SET path=$1 WHERE id=$2 AND user_id=$3 AND tenant_id=$4
       RETURNING id, path, size_bytes, status`,
      [newPath, req.params.id, req.user.id, req.user.tenant_id]
    );

    // Move file on disk
    const oldLocalPath = path.join(LOCAL_PATH, req.user.id, oldPath);
    const newLocalPath = path.join(LOCAL_PATH, req.user.id, newPath);

    if (fs.existsSync(oldLocalPath)) {
      fs.mkdirSync(path.dirname(newLocalPath), { recursive: true });
      fs.renameSync(oldLocalPath, newLocalPath);
    }

    // Also move in pool path if it exists
    const oldPoolPath = path.join(POOL_PATH, req.user.id, oldPath);
    const newPoolPath = path.join(POOL_PATH, req.user.id, newPath);

    if (fs.existsSync(oldPoolPath)) {
      fs.mkdirSync(path.dirname(newPoolPath), { recursive: true });
      fs.renameSync(oldPoolPath, newPoolPath);
    }

    res.json({
      moved: true,
      file: updateResult.rows[0],
      oldPath,
      newPath
    });

    // Audit log file move
    auditLog(req.user.id, 'move', 'file', req.params.id, req, {
      oldPath,
      newPath,
      size_bytes: file.size_bytes
    }).catch(() => {});

  } catch (err) {
    console.error('[files] move:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
