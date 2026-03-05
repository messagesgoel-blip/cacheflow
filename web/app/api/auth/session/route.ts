import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

interface SessionPayload {
  id?: string | number;
  userId?: string | number;
  email?: string;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { authenticated: false, error: 'No active session' },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { authenticated: false, error: 'Server auth configuration missing' },
        { status: 500 }
      );
    }

    const payload = verify(accessToken, secret) as SessionPayload;
    const id = payload?.id ?? payload?.userId ?? null;
    const email = payload?.email ?? '';

    return NextResponse.json({
      authenticated: true,
      user: { id, email },
      accessToken,
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, error: 'Invalid or expired session' },
      { status: 401 }
    );
  }
}
