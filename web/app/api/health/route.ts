import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Create health response
    const healthData: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Add memory and uptime if available in the environment
    if (typeof process !== 'undefined' && process.memoryUsage && process.uptime) {
      try {
        const memoryUsage = process.memoryUsage();
        const uptime = Math.floor(process.uptime());
        
        healthData.memory = {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        };
        healthData.uptime = uptime;
      } catch (memErr) {
        // If memory/uptime collection fails, still return health data
        healthData.memory = null;
        healthData.uptime = null;
      }
    }

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    // Log the actual error server-side for debugging
    console.error('Health check failed:', error instanceof Error ? error : new Error(String(error)));
    
    const errorData = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    };

    return NextResponse.json(errorData, { status: 500 });
  }
}