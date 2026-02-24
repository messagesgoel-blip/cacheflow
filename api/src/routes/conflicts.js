const express = require('express');
const authMw  = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

// GET /conflicts - placeholder response for QA until conflicts are persisted
router.get('/', async (_req, res) => {
  res.json({ conflicts: [] });
});

module.exports = router;
