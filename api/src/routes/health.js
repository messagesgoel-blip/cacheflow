const express = require('express');
const router = express.Router();
const pool = require('../db/client');

router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.ok({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.fail('db disconnected', 503, { error: err.message });
  }
});

router.get('/providers', (req, res) => {
  // Return mock provider health for now
  res.ok({ status: 'ok', providers: [] });
});

module.exports = router;

