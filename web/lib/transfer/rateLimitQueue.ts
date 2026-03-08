type RateLimitStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

interface RateLimitJob {
  id: string;
  provider: string;
  status: RateLimitStatus;
}

const rateLimitJobs = new Map<string, RateLimitJob>();

export async function getRateLimitQueueStats(): Promise<{
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

  for (const job of rateLimitJobs.values()) {
    stats[job.status] += 1;
  }

  return stats;
}

export async function getProviderRateLimitStats(provider: string): Promise<{
  waiting: number;
  delayed: number;
  failed: number;
}> {
  let waiting = 0;
  let delayed = 0;
  let failed = 0;

  for (const job of rateLimitJobs.values()) {
    if (job.provider !== provider) {
      continue;
    }
    if (job.status === 'waiting') {
      waiting += 1;
    } else if (job.status === 'delayed') {
      delayed += 1;
    } else if (job.status === 'failed') {
      failed += 1;
    }
  }

  return { waiting, delayed, failed };
}

export async function clearProviderQueue(provider: string): Promise<number> {
  let removed = 0;

  for (const [id, job] of rateLimitJobs.entries()) {
    if (job.provider === provider && (job.status === 'waiting' || job.status === 'delayed')) {
      rateLimitJobs.delete(id);
      removed += 1;
    }
  }

  return removed;
}

export async function retryTransferJob(jobId: string): Promise<{ id: string } | null> {
  const job = rateLimitJobs.get(jobId);
  if (!job || job.status !== 'failed') {
    return null;
  }

  job.status = 'waiting';
  rateLimitJobs.set(jobId, job);
  return { id: job.id };
}

