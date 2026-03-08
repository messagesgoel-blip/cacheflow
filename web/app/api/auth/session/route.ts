import { NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth/serverSession';

export async function GET() {
  try {
    const session = await resolveServerSession();
    if (!session.authenticated) {
      return NextResponse.json(
        { authenticated: false, error: 'No active session' },
        { status: 401 }
      );
    }
    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        error: 'Invalid or expired session',
      },
      { status: 401 }
    );
  }
}

