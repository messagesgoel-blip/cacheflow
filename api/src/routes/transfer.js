const express = require('express');
const authMw = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

const activeTransfers = new Map();

router.get('/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  const transfer = activeTransfers.get(taskId);

  if (!transfer) {
    return res.status(404).json({ success: false, error: 'Transfer not found' });
  }

  res.json({ success: true, taskId, progress: transfer.progress || 0, status: transfer.status || 'unknown' });
});

router.post('/start', (req, res) => {
  const { sourceProvider, destProvider, fileId, fileName, fileSize } = req.body;

  if (!sourceProvider || !destProvider || !fileId) {
    return res.status(400).json({ success: false, error: 'sourceProvider, destProvider, and fileId are required' });
  }

  const taskId = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  activeTransfers.set(taskId, {
    taskId,
    sourceProvider,
    destProvider,
    fileId,
    fileName: fileName || 'unknown',
    fileSize: fileSize || 0,
    progress: 0,
    status: 'waiting',
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ success: true, taskId });
});

router.delete('/:taskId', (req, res) => {
  const { taskId } = req.params;

  if (!activeTransfers.has(taskId)) {
    return res.status(404).json({ success: false, error: 'Transfer not found' });
  }

  activeTransfers.delete(taskId);
  res.json({ success: true });
});

module.exports = router;
