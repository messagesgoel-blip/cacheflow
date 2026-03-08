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

function getQueue() {
  if (!_queue) {
    const connection = new Redis(REDIS_URL, {
      db: WORKERS_DB,
      maxRetriesPerRequest: null, // required by BullMQ
    });
    _queue = new Queue(TRANSFER_QUEUE_NAME, {
      connection,
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
    `"${data.fileName}" (${data.fileSize || 0} bytes) ` +
    `${data.sourceProvider} → ${data.destProvider}`,
  );

  return job;
}

/**
 * Cancel a transfer job by its BullMQ job ID.
 * Silently succeeds if the job no longer exists.
 * @param {string} jobId
 */
async function cancelTransferJob(jobId) {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    console.log(`[TransferService] Cancelled job ${jobId}`);
  }
}

module.exports = {
  addTransferJob,
  cancelTransferJob,
};
