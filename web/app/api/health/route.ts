import { NextResponse } from 'next/server';

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
  try {
    // Create an AbortController with timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Proxy the request to the backend health endpoint
    const backendResponse = await fetch('http://127.0.0.1:8100/health', {
      signal: controller.signal
    });
    
    // Clear the timeout if the request completes in time
    clearTimeout(timeoutId);
    
    if (backendResponse.ok) {
      const backendData = await backendResponse.json();
      return NextResponse.json(backendData, { status: backendResponse.status });
    } else {
      // If backend returns an error status, return that response
      const backendData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(backendData, { status: backendResponse.status });
    }
  } catch (error) {
    // Clear any pending timeout
    // Note: We can't clear the timeout from here since it might already have fired,
    // but AbortController handles the cleanup properly
    
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
  }
}