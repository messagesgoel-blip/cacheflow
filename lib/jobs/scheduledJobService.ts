import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ThrottleConfig {
  maxBytesPerSecond: number | null; // null means unlimited
}

interface JobCreateData {
  name: string;
  jobType: string;
  cronExpression: string;
  enabled?: boolean;
  throttle?: ThrottleConfig;
}

interface JobUpdateData {
  name?: string;
  jobType?: string;
  cronExpression?: string;
  enabled?: boolean;
  throttle?: ThrottleConfig;
}

export class ScheduledJobService {
  async getAllJobs() {
    return await prisma.scheduledJob.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getJobById(id: string) {
    return await prisma.scheduledJob.findUnique({
      where: { id },
    });
  }

  async createJob(data: JobCreateData) {
    return await prisma.scheduledJob.create({
      data: {
        id: `job_${Date.now()}`,
        name: data.name,
        jobType: data.jobType,
        cronExpression: data.cronExpression,
        enabled: data.enabled ?? true,
        metadata: data.throttle ? JSON.stringify({ throttle: data.throttle }) : undefined,
      },
    });
  }

  async updateJob(id: string, data: JobUpdateData) {
    const existingJob = await prisma.scheduledJob.findUnique({
      where: { id },
    });

    if (!existingJob) {
      return null;
    }

    return await prisma.scheduledJob.update({
      where: { id },
      data,
    });
  }

  async deleteJob(id: string) {
    const existingJob = await prisma.scheduledJob.findUnique({
      where: { id },
    });

    if (!existingJob) {
      return false;
    }

    await prisma.scheduledJob.delete({
      where: { id },
    });
    return true;
  }

  async enableJob(id: string) {
    const existingJob = await prisma.scheduledJob.findUnique({
      where: { id },
    });

    if (!existingJob) {
      return null;
    }

    return await prisma.scheduledJob.update({
      where: { id },
      data: { enabled: true },
    });
  }

  async disableJob(id: string) {
    const existingJob = await prisma.scheduledJob.findUnique({
      where: { id },
    });

    if (!existingJob) {
      return null;
    }

    return await prisma.scheduledJob.update({
      where: { id },
      data: { enabled: false },
    });
  }
}

export const scheduledJobService = new ScheduledJobService();