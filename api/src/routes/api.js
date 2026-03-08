const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db/client');
const authMw = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMw);

const LOCAL_PATH = process.env.LOCAL_CACHE_PATH || '/mnt/local';
const POOL_PATH = process.env.POOL_PATH || '/mnt/pool';

function parseSingleByteRange(rangeHeader, totalSize) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (totalSize <= 0) return null;
  if (rawStart === '' && rawEnd === '') return null;

  if (rawStart === '') {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(totalSize - suffixLength, 0);
    return { start, end: totalSize - 1 };
  }

  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd === '' ? totalSize - 1 : Number.parseInt(rawEnd, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;

  return { start, end: Math.min(end, totalSize - 1) };
}

/**
 * PATCH /api/files/rename
 * Body: { id, newName }
 */
router.patch('/files/rename', async (req, res) => {
  const { id, newName } = req.body;
  
  if (!id || !newName) {
    return res.fail('file id and newName required', 400);
  }

  try {
    const existing = await pool.query(
      `SELECT path FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [id, req.user.id]
    );
    
    if (!existing.rows.length) return res.fail('file not found', 404);
    
    const oldPath = existing.rows[0].path;
    const parts = oldPath.split('/');
    parts.pop();
    const newPath = parts.length > 0 ? `${parts.join('/')}/${newName}` : newName;

    // Check conflict
    const conflict = await pool.query(
      `SELECT id FROM files WHERE user_id=$1 AND path=$2 AND status != 'deleted'`,
      [req.user.id, newPath]
    );
    if (conflict.rows.length) return res.fail('file already exists at destination', 409);

    const result = await pool.query(
      `UPDATE files SET path=$1, last_modified=NOW()
       WHERE id=$2 AND user_id=$3 AND status != 'deleted' RETURNING *`,
      [newPath, id, req.user.id]
    );

    if (!result.rows.length) return res.fail('failed to rename', 500);

    // Disk rename
    const oldDisk = path.join(LOCAL_PATH, req.user.id, oldPath);
    const newDisk = path.join(LOCAL_PATH, req.user.id, newPath);
    if (fs.existsSync(oldDisk)) {
      fs.mkdirSync(path.dirname(newDisk), { recursive: true });
      fs.renameSync(oldDisk, newDisk);
    }

    auditLog(req.user.id, 'rename', 'file', id, req, { oldPath, newPath }).catch(() => {});
    
    res.ok({ file: result.rows[0] });
  } catch (err) {
    console.error(`[API] rename error [${req.requestId}]:`, err.message);
    res.fail('internal server error', 500);
  }
});

/**
 * POST /api/files/move
 * Body: { id, newParentPath }
 */
router.post('/files/move', async (req, res) => {
  const { id, newParentPath } = req.body;
  
  if (!id || newParentPath === undefined) {
    return res.fail('file id and newParentPath required', 400);
  }

  try {
    const existing = await pool.query(
      `SELECT path, size_bytes FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [id, req.user.id]
    );
    
    if (!existing.rows.length) return res.fail('file not found', 404);
    
    const oldPath = existing.rows[0].path;
    const fileName = oldPath.split('/').pop();
    const cleanParent = newParentPath.replace(/^\/+|\/+$/g, '');
    const newPath = cleanParent ? `${cleanParent}/${fileName}` : fileName;

    if (oldPath === newPath) return res.ok({ file: { id, path: oldPath }, moved: false });

    // Check conflict
    const conflict = await pool.query(
      `SELECT id FROM files WHERE user_id=$1 AND path=$2 AND status != 'deleted'`,
      [req.user.id, newPath]
    );
    if (conflict.rows.length) return res.fail('destination already exists', 409);

    const result = await pool.query(
      `UPDATE files SET path=$1, last_modified=NOW()
       WHERE id=$2 AND user_id=$3 AND status != 'deleted' RETURNING *`,
      [newPath, id, req.user.id]
    );

    // Disk move
    const oldLocalPath = path.join(LOCAL_PATH, req.user.id, oldPath);
    const newLocalPath = path.join(LOCAL_PATH, req.user.id, newPath);

    if (fs.existsSync(oldLocalPath)) {
      fs.mkdirSync(path.dirname(newLocalPath), { recursive: true });
      fs.renameSync(oldLocalPath, newLocalPath);
    }

    auditLog(req.user.id, 'move', 'file', id, req, { oldPath, newPath }).catch(() => {});
    
    res.ok({ moved: true, file: result.rows[0] });
  } catch (err) {
    console.error(`[API] move error [${req.requestId}]:`, err.message);
    res.fail('internal server error', 500);
  }
});

/**
 * POST /api/files/download
 * Body: { id }
 */
router.post('/files/download', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.fail('id required', 400);

  try {
    const result = await pool.query(
      `SELECT path, size_bytes FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [id, req.user.id]
    );
    if (!result.rows.length) return res.fail('file not found', 404);
    
    const file = result.rows[0];
    const poolPath = path.join(POOL_PATH, req.user.id, file.path);
    const localPath = path.join(LOCAL_PATH, req.user.id, file.path);
    const diskPath = fs.existsSync(poolPath) ? poolPath : localPath;
    
    if (!fs.existsSync(diskPath))
      return res.fail('file not on disk — sync may be pending', 404);

    // For download, we might want to return a temp URL or stream.
    // The requirement says POST /api/files/download.
    // In a production-grade API, a POST download often returns a signed URL or sets up a session.
    // But here we can just return the data if small, or provide a way to get it.
    // If the requirement is to trigger actual download response path, we might still need a GET or a specific response.
    // However, the prompt says "POST /api/files/download". 
    // I'll implement it to return a successful status and maybe some metadata, 
    // but usually actual downloads are GET. 
    // If I must use POST, I'll return the base64 or similar? No, usually not for 500MB files.
    // I'll implement it to return a token that can be used for a GET download, or just stream it if Express allows.
    // Express allows streaming in POST.
    
    const totalSize = Number(fs.statSync(diskPath).size || file.size_bytes || 0);
    const range = parseSingleByteRange(req.headers.range, totalSize);
    if (req.headers.range && !range && totalSize > 0) {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).json({ ok: false, error: 'requested range not satisfiable' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file.path)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Request-Id', req.requestId);

    if (totalSize === 0) {
      res.setHeader('Content-Length', '0');
      return res.status(200).end();
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : totalSize - 1;
    const contentLength = end - start + 1;

    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    }
    res.setHeader('Content-Length', String(contentLength));

    const stream = fs.createReadStream(diskPath, { start, end });
    stream.pipe(res);

    stream.on('finish', () => {
      auditLog(req.user.id, 'download', 'file', id, req, { size_bytes: file.size_bytes }).catch(() => {});
    });
  } catch (err) {
    console.error(`[API] download error [${req.requestId}]:`, err.message);
    if (!res.headersSent) res.fail('internal server error', 500);
  }
});

/**
 * POST /api/share
 * Body: { id, password, expires_in_hours, max_downloads }
 */
router.post('/share', async (req, res) => {
  const { id, password, expires_in_hours, max_downloads } = req.body;
  if (!id) return res.fail('file id required', 400);

  try {
    const fileRes = await pool.query(
      `SELECT id FROM files WHERE id=$1 AND user_id=$2 AND status != 'deleted'`,
      [id, req.user.id]
    );
    if (!fileRes.rows.length) return res.fail('file not found', 404);
    
    const token = crypto.randomBytes(32).toString('hex');
    const password_hash = password ? await bcrypt.hash(password, 12) : null;
    const expires_at = expires_in_hours
      ? new Date(Date.now() + expires_in_hours * 3600 * 1000) : null;
      
    const result = await pool.query(
      `INSERT INTO shared_links (file_id, token, password_hash, expires_at, max_downloads, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, token, expires_at, max_downloads, created_at`,
      [id, token, password_hash, expires_at, max_downloads || null, req.user.id]
    );
    
    const link = result.rows[0];
    auditLog(req.user.id, 'share', 'file', id, req, { expires_in_hours, max_downloads, password_protected: !!password }).catch(() => {});
    
    res.ok({
      share_url: `/share/${link.token}`,
      token: link.token,
      expires_at: link.expires_at,
      max_downloads: link.max_downloads,
      password_protected: !!password
    });
  } catch (err) {
    console.error(`[API] share error [${req.requestId}]:`, err.message);
    res.fail('internal server error', 500);
  }
});

module.exports = router;
