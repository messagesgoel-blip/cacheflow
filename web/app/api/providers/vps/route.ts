import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveServerApiBase } from '@/lib/auth/serverApiBase'

function buildForwardHeaders(request: NextRequest, accessToken?: string | null): HeadersInit {
  const authHeaderFromRequest = request.headers.get('authorization')
  const authHeader = authHeaderFromRequest || (accessToken ? `Bearer ${accessToken}` : null)
  const cookieHeader = request.headers.get('cookie')
  return {
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    ...(request.headers.get('content-type')
      ? { 'Content-Type': request.headers.get('content-type') as string }
      : {}),
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('accessToken')?.value
    const apiBase = resolveServerApiBase()
    const body = await request.arrayBuffer()

    const upstream = await fetch(`${apiBase}/api/providers/vps`, {
      method: 'POST',
      headers: buildForwardHeaders(request, accessToken),
      body,
      cache: 'no-store',
    })

    const contentType = upstream.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const payload = await upstream.json()
      return NextResponse.json(payload, { status: upstream.status })
    }
    return new NextResponse(upstream.body, { status: upstream.status })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to connect VPS provider' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('accessToken')?.value
    const apiBase = resolveServerApiBase()
    const upstream = await fetch(`${apiBase}/api/providers/vps`, {
      method: 'GET',
      headers: buildForwardHeaders(request, accessToken),
      cache: 'no-store',
    })
    const payload = await upstream.json().catch(() => ({}))
    return NextResponse.json(payload, { status: upstream.status })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load VPS providers' },
      { status: 500 }
    )
  }
}
