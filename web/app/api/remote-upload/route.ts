import { NextRequest } from 'next/server';
import { remoteUpload } from '@/lib/transfers/remoteUpload';

export async function POST(request: NextRequest) {
  try {
    const { url, provider, filename, metadata } = await request.json();

    if (!url || !provider) {
      return Response.json(
        { error: 'URL and provider are required' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch (error) {
      return Response.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await remoteUpload({
      url,
      provider,
      filename,
      metadata
    });

    return Response.json(result);
  } catch (error: any) {
    console.error('Remote upload error:', error);
    
    if (error.message?.includes('timeout')) {
      return Response.json(
        { error: 'Timeout downloading from remote URL' },
        { status: 504 }
      );
    }
    
    if (error.message?.includes('not found') || error.status === 404) {
      return Response.json(
        { error: 'Remote file not found' },
        { status: 502 }
      );
    }

    return Response.json(
      { error: 'Internal server error during remote upload' },
      { status: 500 }
    );
  }
}