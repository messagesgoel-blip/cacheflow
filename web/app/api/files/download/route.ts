import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { resolveServerApiBase } from '@/lib/auth/serverApiBase'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const authHeaderFromRequest = request.headers.get('authorization')
  const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)
  const cookieHeader = request.headers.get('cookie')

  if (!authHeader) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  const body = await request.text()
  const apiBase = resolveServerApiBase()
  const upstream = await fetch(`${apiBase}/api/files/download`, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body,
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  const disposition = upstream.headers.get('content-disposition')
  const contentLength = upstream.headers.get('content-length')

  if (contentType) responseHeaders.set('content-type', contentType)
  if (disposition) responseHeaders.set('content-disposition', disposition)
  if (contentLength) responseHeaders.set('content-length', contentLength)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

