/**
 * Transfer Service — thin wrapper around BullMQ for the Express API.
 *
 * Mirrors the public API of lib/queue/transferQueue.ts but runs in
 * plain JS (the Express API does not use a TS transpiler at runtime).
 *
 * Connects to Redis db=4 (workers namespace) matching lib/redis/client.ts.
 */

const { randomUUID } = require('crypto');
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const TRANSFER_QUEUE_NAME = 'cacheflow:transfers';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKERS_DB = 4;

let _queue;
let _connection;

function registerConnectionHandlers(connection) {
  connection.on('error', (err) => {
    console.error('[TransferService] Redis connection error:', err.message);
  });
  connection.on('ready', () => {
    console.log('[TransferService] Redis connection ready');
  });
  connection.on('reconnecting', () => {
    console.warn('[TransferService] Redis connection reconnecting');
  });
}

function getQueue() {
  if (!_queue) {
    _connection = new Redis(REDIS_URL, {
      db: WORKERS_DB,
      maxRetriesPerRequest: null, // required by BullMQ
    });
    registerConnectionHandlers(_connection);
    _queue = new Queue(TRANSFER_QUEUE_NAME, {
      connection: _connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }
  return _queue;
}

/**
 * Enqueue a new file transfer job.
 * @param {object} data - TransferJobData payload
 * @returns {Promise<import('bullmq').Job>}
 */
async function addTransferJob(data) {
  const queue = getQueue();
  const jobId = `transfer-${data.userId}-${randomUUID()}`;
  const priority = (data.fileSize || 0) >= 50 * 1024 * 1024 ? 5 : 10;

  const job = await queue.add(jobId, data, { jobId, priority });

  console.log(
    `[TransferService] Enqueued job ${job.id}: ` +
    `${data.sourceProvider} → ${data.destProvider} ` +
    `(${data.fileSize || 0} bytes)`,
  );

  return job;
}

async function getTransferJob(jobId) {
  const queue = getQueue();
  return queue.getJob(jobId);
}

/**
 * Cancel a transfer job by its BullMQ job ID.
 * Silently succeeds if the job no longer exists.
 * @param {string} jobId
 */
async function cancelTransferJob(jobId) {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (!job) return false;

  if (await job.isActive()) {
    // Active jobs are locked by the worker — job.remove() would throw.
    // TODO: implement worker-side cancellation via AbortSignal.
    console.warn(`[TransferService] Job ${jobId} is active; cannot cancel without worker support`);
    return false;
  }

  await job.remove();
  console.log(`[TransferService] Cancelled job ${jobId}`);
  return true;
}

async function closeQueue() {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  if (_connection) {
    _connection.disconnect();
    _connection = null;
  }
}

async function handleShutdown(signal) {
  try {
    await closeQueue();
  } catch (err) {
    console.error(`[TransferService] Failed during ${signal} shutdown:`, err.message);
  }
}

process.once('SIGINT', () => {
  void handleShutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void handleShutdown('SIGTERM');
});

module.exports = {
  addTransferJob,
  getTransferJob,
  cancelTransferJob,
  closeQueue,
};
