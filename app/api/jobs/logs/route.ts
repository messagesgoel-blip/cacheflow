/**
 * SSE Job Logs Endpoint
 *
 * GET /api/jobs/logs?jobId=xxx
 * Streams real-time worker log events as Server-Sent Events.
 *
 * Events emitted:
 * - connected: Initial connection established
 * - log: Worker log entry
 * - done: Terminal event when job completes (success or failure)
 *
 * Gate: SSE-1, LOGS-1
 * Task: 6.2@LOGS-1
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { progressEmitter } from '../../../../lib/transfers/progressEmitter';
import { WorkerLogEntry, ProgressUpdate } from '../../../../lib/transfers/progressBridge';

interface JwtPayload {
  id: string;
  email?: string;
}

const SSE_KEEPALIVE_MS = 15_000;

function unauthorizedStream(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function badRequestStream(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function serverErrorStream(message: string): Response {
  return new Response(message, {
    status: 500,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function sseEvent(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId || jobId.trim() === '') {
    return badRequestStream('Job ID required');
  }

  let userId: string;
  const testUserId = process.env.NODE_ENV === 'test'
    ? process.env.TEST_BYPASS_AUTH_USER_ID
    : undefined;

  if (testUserId) {
    userId = testUserId;
  } else {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return unauthorizedStream();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[jobs/logs] JWT_SECRET is not set; refusing to verify access token.');
      return serverErrorStream('Server configuration error');
    }

    try {
      const { verify } = await import('jsonwebtoken');
      const decoded = verify(accessToken, jwtSecret) as JwtPayload;
      userId = decoded.id;
    } catch {
      return unauthorizedStream();
    }
  }

  await progressEmitter.initialize();

  const encoder = new TextEncoder();
  let isFinished = false;

  const stream = new ReadableStream({
    start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
      let unsubscribeLogs: (() => void) | null = null;
      let unsubscribeProgress: (() => void) | null = null;

      const enqueue = (chunk: string): void => {
        if (isFinished) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream closed
        }
      };

      const cleanup = (): void => {
        isFinished = true;
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
          keepaliveTimer = null;
        }
        if (unsubscribeLogs) unsubscribeLogs();
        if (unsubscribeProgress) unsubscribeProgress();
      };

      const sendDone = (status: 'completed' | 'failed', error?: string): void => {
        if (isFinished) return;
        enqueue(sseEvent('done', { status, error }));
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      enqueue(sseEvent('connected', { jobId, userId }));

      keepaliveTimer = setInterval(() => {
        enqueue(': keepalive\n\n');
      }, SSE_KEEPALIVE_MS);

      // Subscribe to worker log events (LOGS-1)
      const jobLogsUnsubscribe = progressEmitter.onJobLogs(
        userId,
        jobId,
        (entry: WorkerLogEntry) => {
          // Forward log entry as SSE event
          enqueue(sseEvent('log', entry));
        }
      );
      unsubscribeLogs = jobLogsUnsubscribe;
      if (isFinished) {
        unsubscribeLogs();
      }

      // Subscribe to progress for authoritative completion status
      const jobProgressUnsubscribe = progressEmitter.onJobProgress(
        userId,
        jobId,
        (update: ProgressUpdate) => {
          // Forward progress as well for completeness
          enqueue(sseEvent('progress', update));

          // Terminal signals from authoritative progress
          if (update.status === 'completed') {
            sendDone('completed');
          } else if (update.status === 'failed') {
            sendDone('failed', update.error);
          }
        }
      );
      unsubscribeProgress = jobProgressUnsubscribe;
      if (isFinished) {
        unsubscribeProgress();
      }

      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
