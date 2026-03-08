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

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const apiBase = resolveServerApiBase()

  const upstream = await fetch(`${apiBase}/api/favorites`, {
    method: 'GET',
    headers: buildForwardHeaders(request, tokenFromCookie),
    cache: 'no-store',
  })

  if (upstream.status >= 500) {
    // Favorites are secondary UI state; keep the files view usable when the backend table/service is unavailable.
    return NextResponse.json({
      ok: true,
      data: {
        favorites: [],
        degraded: true,
      },
    })
  }

  return proxyJson(upstream)
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const apiBase = resolveServerApiBase()
  const body = await request.text()

  const upstream = await fetch(`${apiBase}/api/favorites`, {
    method: 'POST',
    headers: buildForwardHeaders(request, tokenFromCookie),
    body,
    cache: 'no-store',
  })

  return proxyJson(upstream)
}

