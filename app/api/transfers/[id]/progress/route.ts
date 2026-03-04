/**
 * SSE Transfer Progress Endpoint
 *
 * GET /api/transfers/[id]/progress
 * Streams real-time transfer progress as Server-Sent Events.
 *
 * Gate: SSE-1
 * Task: 3.2@SSE-1
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { progressEmitter } from '../../../../lib/transfers/progressEmitter';
import { ProgressUpdate } from '../../../../lib/transfers/progressBridge';

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

function sseEvent(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: jobId } = await params;

  if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
    return badRequestStream('Transfer ID required');
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    return unauthorizedStream();
  }

  let userId: string;
  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as JwtPayload;
    userId = decoded.id;
  } catch {
    return unauthorizedStream();
  }

  await progressEmitter.initialize();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string): void => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const cleanup = (): void => {
        clearInterval(keepaliveTimer);
        unsubscribe();
      };

      const unsubscribe = progressEmitter.onJobProgress(
        userId,
        jobId,
        (update: ProgressUpdate) => {
          enqueue(sseEvent('progress', update));

          if (update.status === 'completed' || update.status === 'failed') {
            enqueue(sseEvent('done', { status: update.status }));
            cleanup();
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        }
      );

      enqueue(sseEvent('connected', { jobId, userId }));

      const keepaliveTimer = setInterval(() => {
        enqueue(': keepalive\n\n');
      }, SSE_KEEPALIVE_MS);

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
