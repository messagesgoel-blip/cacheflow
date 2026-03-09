import { NextRequest } from 'next/server';
import { scheduledJobService } from '@/lib/jobs/scheduledJobService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id) {
      const job = await scheduledJobService.getJobById(id);
      if (!job) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      return Response.json(job);
    }

    const jobs = await scheduledJobService.getAllJobs();
    return Response.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const requiredFields = ['name', 'jobType', 'cronExpression'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return Response.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Validate throttle if provided
    if (data.throttle && data.throttle.maxBytesPerSecond !== null) {
      const bps = data.throttle.maxBytesPerSecond;
      if (!Number.isFinite(bps) || bps <= 0) {
        return Response.json({ error: 'throttle.maxBytesPerSecond must be a positive finite number or null' }, { status: 400 });
      }
    }

    const job = await scheduledJobService.createJob({
      name: data.name,
      jobType: data.jobType,
      cronExpression: data.cronExpression,
      enabled: data.enabled ?? true,
      throttle: data.throttle || undefined,
    });

    return Response.json(job, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);
    return Response.json({ error: 'Failed to create job' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return Response.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const data = await request.json();
    
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.jobType !== undefined) updateData.jobType = data.jobType;
    if (data.cronExpression !== undefined) updateData.cronExpression = data.cronExpression;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.throttle !== undefined) updateData.throttle = data.throttle;

    const job = await scheduledJobService.updateJob(id, updateData);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    return Response.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return Response.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const deleted = await scheduledJobService.deleteJob(id);
    if (!deleted) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    return Response.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
