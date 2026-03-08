import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { withSecurityScan } from '@/lib/auth/securityAudit';
import { resolveServerApiBase } from '@/lib/auth/serverApiBase';

function parseResponseByContentType(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const cookieStore = await cookies();
  const tokenFromCookie = cookieStore.get('accessToken')?.value;
  const authHeaderFromRequest = request.headers.get('authorization');
  const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null);
  const cookieHeader = request.headers.get('cookie');

  const apiBase = resolveServerApiBase();
  const upstream = await fetch(`${apiBase}/api/remotes/${uuid}/health`, {
    method: 'GET',
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  });

  const payload = await parseResponseByContentType(upstream);

  if (typeof payload === 'string') {
    return new NextResponse(payload, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/plain',
      },
    });
  }

  const scannedPayload = withSecurityScan(
    (payload && typeof payload === 'object' ? payload : { value: payload }) as Record<string, any>,
    `/api/remotes/${uuid}/health`,
  );

  return NextResponse.json(scannedPayload, {
    status: upstream.status,
  });
}

