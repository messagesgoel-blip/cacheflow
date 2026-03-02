const express = require('express');
const pool = require('../db/client');
const authMw = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

/**
 * GET /api/favorites - Get all user favorites
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.ok({ favorites: result.rows });
  } catch (err) {
    console.error(`[favorites] get error:`, err.message);
    res.fail('internal server error', 500);
  }
});

/**
 * POST /api/favorites - Add a favorite
 */
router.post('/', async (req, res) => {
  const { provider, accountKey, fileId, fileName, mimeType, isFolder, path, metadata } = req.body;

  if (!provider || !accountKey || !fileId || !fileName) {
    return res.fail('missing required fields', 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_favorites 
       (user_id, provider, account_key, file_id, file_name, mime_type, is_folder, path, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, provider, account_key, file_id) 
       DO UPDATE SET file_name = EXCLUDED.file_name, path = EXCLUDED.path, metadata = EXCLUDED.metadata
       RETURNING *`,
      [req.user.id, provider, accountKey, fileId, fileName, mimeType, isFolder || false, path, metadata || {}]
    );
    res.ok({ favorite: result.rows[0] });
  } catch (err) {
    console.error(`[favorites] add error:`, err.message);
    res.fail('internal server error', 500);
  }
});

/**
 * DELETE /api/favorites/:id - Remove a favorite by internal ID or composite key
 * (Implementation allows deleting by fileId for easier frontend usage)
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { provider, accountKey } = req.query;

  try {
    let result;
    if (provider && accountKey) {
      // Delete by composite key (provider + accountKey + fileId)
      result = await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND provider = $2 AND account_key = $3 AND file_id = $4 RETURNING *`,
        [req.user.id, provider, accountKey, id]
      );
    } else {
      // Delete by UUID
      result = await pool.query(
        `DELETE FROM user_favorites WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, req.user.id]
      );
    }

    if (result.rowCount === 0) return res.fail('favorite not found', 404);
    res.ok({ deleted: true });
  } catch (err) {
    console.error(`[favorites] delete error:`, err.message);
    res.fail('internal server error', 500);
  }
});

module.exports = router;
