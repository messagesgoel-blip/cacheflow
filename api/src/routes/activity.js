const express = require('express');
const pool = require('../db/client');
const authMw = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

/**
 * GET /api/activity - Get user activity feed
 * Query params: limit, offset, action, provider
 */
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  const { action, provider } = req.query;

  try {
    let query = `SELECT * FROM audit_logs WHERE user_id = $1`;
    const params = [req.user.id];

    if (action) {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }

    if (provider) {
      params.push(provider);
      query += ` AND metadata->>'providerId' = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    res.ok({ 
      activity: result.rows,
      limit,
      offset,
      count: result.rowCount
    });
  } catch (err) {
    console.error(`[activity] get error:`, err.message);
    res.fail('internal server error', 500);
  }
});

module.exports = router;

