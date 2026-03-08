const express = require('express');
const authMw = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

// In-memory transfer registry for the control plane (process-local).
// Actual data movement is dispatched by BullMQ workers via progressBridge;
// this map tracks metadata for status queries and cancellation.
// Note: not shared across replicas — suitable for single-instance or
// sticky-session deployments. Use Redis-backed state for horizontal scaling.
const activeTransfers = new Map();

router.get('/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  const transfer = activeTransfers.get(taskId);

  if (!transfer || transfer.owner !== req.user.id) {
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
    owner: req.user.id,
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
  const transfer = activeTransfers.get(taskId);

  if (!transfer || transfer.owner !== req.user.id) {
    return res.status(404).json({ success: false, error: 'Transfer not found' });
  }

  activeTransfers.delete(taskId);
  res.json({ success: true });
});

module.exports = router;
