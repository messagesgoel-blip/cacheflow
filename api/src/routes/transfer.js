const express = require('express');
const authMw = require('../middleware/auth');
const { addTransferJob, cancelTransferJob } = require('../services/transferService');

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

router.post('/start', async (req, res) => {
  const { sourceProvider, destProvider, fileId, fileName, fileSize, sourceFolderId, destFolderId } = req.body;

  if (!sourceProvider || !destProvider || !fileId) {
    return res.status(400).json({ success: false, error: 'sourceProvider, destProvider, and fileId are required' });
  }

  try {
    const job = await addTransferJob({
      userId: req.user.id,
      sourceProvider,
      destProvider,
      fileId,
      fileName: fileName || 'unknown',
      fileSize: parseInt(fileSize, 10) || 0,
      sourceFolderId,
      destFolderId,
      operation: 'copy',
    });

    const taskId = job.id;
    activeTransfers.set(taskId, {
      taskId,
      jobId: taskId,
      owner: req.user.id,
      sourceProvider,
      destProvider,
      fileId,
      fileName: fileName || 'unknown',
      fileSize: parseInt(fileSize, 10) || 0,
      progress: 0,
      status: 'queued',
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, taskId });
  } catch (err) {
    console.error('[transfer] Failed to enqueue transfer:', err.message);
    res.status(500).json({ success: false, error: 'Failed to enqueue transfer' });
  }
});

router.delete('/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const transfer = activeTransfers.get(taskId);

  if (!transfer || transfer.owner !== req.user.id) {
    return res.status(404).json({ success: false, error: 'Transfer not found' });
  }

  try {
    if (transfer.jobId) {
      await cancelTransferJob(transfer.jobId);
    }
  } catch (err) {
    console.error(`[transfer] Failed to cancel BullMQ job ${transfer.jobId}:`, err.message);
  }

  activeTransfers.delete(taskId);
  res.json({ success: true });
});

module.exports = router;
