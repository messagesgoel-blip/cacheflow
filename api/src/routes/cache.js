const express = require('express');
const router = express.Router();

// Simple in-memory hot cache for metadata
const serverCache = new Map();

router.get('/', (req, res) => {
  res.ok({ status: 'ok', keys: Array.from(serverCache.keys()) });
});

router.post('/invalidate', (req, res) => {
  serverCache.clear();
  res.ok({ status: 'ok', cleared: true });
});

module.exports = router;
