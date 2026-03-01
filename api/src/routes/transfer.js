const express = require('express');
const router = express.Router();

const activeTransfers = new Map();

router.get('/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  res.ok({ status: 'ok', taskId, progress: activeTransfers.get(taskId) || 0 });
});

router.post('/start', (req, res) => {
  const taskId = Date.now().toString();
  activeTransfers.set(taskId, 0);
  res.ok({ status: 'ok', taskId });
});

module.exports = router;
