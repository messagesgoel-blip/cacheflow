import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { resolveServerApiBase } from '@/lib/auth/serverApiBase'

function buildForwardHeaders(request: NextRequest, tokenFromCookie?: string | null): HeadersInit {
  const authHeaderFromRequest = request.headers.get('authorization')
  const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)
  const cookieHeader = request.headers.get('cookie')

  return {
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    'Content-Type': request.headers.get('content-type') || 'application/json',
  }
}

async function proxyJson(response: Response) {
  const payload = await response.json().catch(() => ({
    ok: response.ok,
    error: response.statusText,
  }))

  return NextResponse.json(payload, {
    status: response.status,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const apiBase = resolveServerApiBase()
  const search = request.nextUrl.searchParams.toString()
  const suffix = search ? `?${search}` : ''

  const upstream = await fetch(`${apiBase}/api/favorites/${id}${suffix}`, {
    method: 'DELETE',
    headers: buildForwardHeaders(request, tokenFromCookie),
    cache: 'no-store',
  })

  return proxyJson(upstream)
}
