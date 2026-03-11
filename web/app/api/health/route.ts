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
    // Proxy the request to the backend health endpoint
    const backendResponse = await fetch('http://127.0.0.1:8100/health');
    
    if (backendResponse.ok) {
      const backendData = await backendResponse.json();
      return NextResponse.json(backendData, { status: backendResponse.status });
    } else {
      // If backend returns an error status, return that response
      const backendData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(backendData, { status: backendResponse.status });
    }
  } catch (error) {
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