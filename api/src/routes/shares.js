const express  = require('express');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');
const pool     = require('../db/client');

const router = express.Router();
const LOCAL_PATH = process.env.LOCAL_CACHE_PATH || '/mnt/local';
const POOL_PATH  = process.env.POOL_PATH        || '/mnt/pool';

// GET /share/:token — public download, no auth required
router.get('/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sl.*, f.path AS file_path, f.size_bytes, f.user_id
       FROM shared_links sl
       JOIN files f ON f.id = sl.file_id
       WHERE sl.token=$1 AND f.status != 'deleted'`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'link not found' });
    const link = result.rows[0];

    if (link.expires_at && new Date() > new Date(link.expires_at))
      return res.status(410).json({ error: 'link expired' });

    if (link.max_downloads && link.download_count >= link.max_downloads)
      return res.status(410).json({ error: 'download limit reached' });

    if (link.password_hash) {
      const provided = req.headers['x-share-password'] || req.query.password;
      if (!provided) return res.status(401).json({ error: 'password required' });
      if (!(await bcrypt.compare(provided, link.password_hash)))
        return res.status(401).json({ error: 'invalid password' });
    }

    const poolPath  = path.join(POOL_PATH,  link.user_id, link.file_path);
    const localPath = path.join(LOCAL_PATH, link.user_id, link.file_path);
    const diskPath  = fs.existsSync(poolPath) ? poolPath : localPath;

    if (!fs.existsSync(diskPath))
      return res.status(404).json({ error: 'file not on disk — sync may be pending' });

    await pool.query(
      'UPDATE shared_links SET download_count = download_count + 1 WHERE id=$1',
      [link.id]
    );

    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(link.file_path)}"`);
    res.setHeader('Content-Length', link.size_bytes);
    fs.createReadStream(diskPath).pipe(res);
  } catch (err) {
    console.error('[share] download:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
