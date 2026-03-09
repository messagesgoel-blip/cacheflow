import type { ScheduledJob, ThrottleConfig } from './types'

type JobRecord = ScheduledJob

interface JobCreateData {
  name: string
  jobType: string
  cronExpression: string
  enabled?: boolean
  throttle?: ThrottleConfig
}

interface JobUpdateData {
  name?: string
  jobType?: string
  cronExpression?: string
  enabled?: boolean
  throttle?: ThrottleConfig
}

const scheduledJobs = new Map<string, JobRecord>()

function nowIso() {
  return new Date().toISOString()
}

class ScheduledJobService {
  async getAllJobs() {
    return Array.from(scheduledJobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getJobById(id: string) {
    return scheduledJobs.get(id) ?? null
  }

  async createJob(data: JobCreateData) {
    const createdAt = nowIso()
    const job: JobRecord = {
      id: `job_${Date.now()}`,
      name: data.name,
      jobType: data.jobType,
      cronExpression: data.cronExpression,
      enabled: data.enabled ?? true,
      throttle: data.throttle,
      lastRunAt: null,
      nextRunAt: null,
      createdAt,
      updatedAt: createdAt,
    }
    scheduledJobs.set(job.id, job)
    return job
  }

  async updateJob(id: string, data: JobUpdateData) {
    const existing = scheduledJobs.get(id)
    if (!existing) return null

    const next: JobRecord = {
      ...existing,
      ...data,
      updatedAt: nowIso(),
    }
    scheduledJobs.set(id, next)
    return next
  }

  async deleteJob(id: string) {
    return scheduledJobs.delete(id)
  }
}

export const scheduledJobService = new ScheduledJobService()
