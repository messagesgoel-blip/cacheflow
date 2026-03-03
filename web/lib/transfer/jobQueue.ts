export interface TransferJobData {
  userId: string;
  sourceProvider: string;
  destProvider: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  sourceFolderId?: string;
  destFolderId?: string;
  operation: 'copy' | 'move' | 'upload' | 'download';
}

export interface TransferJob {
  id: string;
  data: TransferJobData;
  progress: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
}

const transferJobs = new Map<string, TransferJob>();

export async function addTransferJob(data: TransferJobData): Promise<TransferJob> {
  const now = Date.now();
  const id = `transfer-${data.userId}-${now}`;
  const job: TransferJob = {
    id,
    data,
    progress: 0,
    timestamp: now,
    status: 'waiting',
  };
  transferJobs.set(id, job);
  return job;
}

export async function getTransferJob(jobId: string): Promise<TransferJob | undefined> {
  return transferJobs.get(jobId);
}

export async function getUserTransferJobs(userId: string, limit = 50): Promise<TransferJob[]> {
  return Array.from(transferJobs.values())
    .filter((job) => job.data.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const stats = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };

  for (const job of transferJobs.values()) {
    stats[job.status] += 1;
  }

  return stats;
}

export async function cancelTransferJob(jobId: string): Promise<void> {
  transferJobs.delete(jobId);
}
