import { NextResponse } from 'next/server';
import { resolveServerApiBase } from '@/lib/auth/serverApiBase';

interface HealthData {
  status: 'ok' | 'error';
  timestamp: string;
  memory?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } | null;
  uptime?: number | null;
}

export async function GET() {
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    // Create an AbortController with timeout for the fetch request
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Proxy the request to the backend health endpoint
    const apiBase = resolveServerApiBase();
    const backendResponse = await fetch(`${apiBase}/health`, {
      signal: controller.signal
    });
    
    const backendData = await backendResponse.json().catch(() => ({}));
    const data = backendData?.data && typeof backendData.data === 'object' ? backendData.data : backendData;
    const status = data?.status || (backendResponse.ok ? 'ok' : 'error');
    const timestamp = data?.timestamp || data?.ts || new Date().toISOString();

    return NextResponse.json(
      {
        status,
        timestamp,
        memory: data?.memory ?? null,
        uptime: data?.uptime ?? null,
      },
      { status: backendResponse.ok ? 200 : backendResponse.status }
    );
  } catch (error) {
    // Check if the error was due to timeout/abort
    if (error instanceof Error && error.name === 'AbortError') {
      // Log the timeout error server-side for debugging
      console.error('Health check timed out:', error);
      
      // Return 502 Bad Gateway when backend request times out
      const errorData = {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Backend health service unavailable'
      };

      return NextResponse.json(errorData, { status: 502 });
    } else {
      // Log the actual error server-side for debugging
      console.error('Health check failed:', error instanceof Error ? error : new Error(String(error)));
      
      // Return 502 Bad Gateway when backend is unreachable
      const errorData = {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Backend health service unavailable'
      };

      return NextResponse.json(errorData, { status: 502 });
    }
  } finally {
    // Always clear the timeout to prevent memory leaks
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
