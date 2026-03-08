import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveServerApiBase } from '@/lib/auth/serverApiBase'

function buildForwardHeaders(request: NextRequest, tokenFromCookie?: string | null): HeadersInit {
  const authHeaderFromRequest = request.headers.get('authorization')
  const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)
  const cookieHeader = request.headers.get('cookie')
  const contentType = request.headers.get('content-type')

  return {
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('accessToken')?.value
    const apiBase = resolveServerApiBase()

    const response = await fetch(`${apiBase}/api/remotes`, {
      method: 'GET',
      headers: buildForwardHeaders(request, accessToken),
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    console.error('[web/api/remotes] GET proxy error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch remotes',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('accessToken')?.value
    const apiBase = resolveServerApiBase()
    const body = await request.text()

    const response = await fetch(`${apiBase}/api/remotes`, {
      method: 'POST',
      headers: buildForwardHeaders(request, accessToken),
      body,
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    console.error('[web/api/remotes] POST proxy error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save remote',
      },
      { status: 500 },
    )
  }
}
