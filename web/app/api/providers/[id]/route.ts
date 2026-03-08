import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DEFAULT_API_BASE = 'http://127.0.0.1:8100'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  } catch {
    return false
  }
}

function resolveApiBase(): string {
  const candidates = [
    process.env.API_INTERNAL_URL,
    process.env.CACHEFLOW_API_INTERNAL_URL,
    process.env.API_URL,
    DEFAULT_API_BASE,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:8100',
  ].filter(Boolean) as string[]

  const nonLoopback = candidates.find((candidate) => !isLoopbackUrl(candidate))
  const selected = nonLoopback || candidates[0] || DEFAULT_API_BASE
  return normalizeBaseUrl(selected)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ success: false, error: 'Provider ID is required' }, { status: 400 })
  }

  try {
    const cookieStore = await cookies()
    const tokenFromCookie = cookieStore.get('accessToken')?.value
    const authHeaderFromRequest = request.headers.get('authorization')
    const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)
    const cookieHeader = request.headers.get('cookie')

    if (!authHeader && !cookieHeader) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const apiBase = resolveApiBase()
    const backendResponse = await fetch(`${apiBase}/api/providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(authHeader && { Authorization: authHeader }),
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      cache: 'no-store',
    })

    const payload = await backendResponse.json().catch(() => ({}))
    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.error || payload?.message || 'Failed to disconnect provider',
        },
        { status: backendResponse.status }
      )
    }

    return NextResponse.json({ success: true, deleted: true, id })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to disconnect provider',
      },
      { status: 500 }
    )
  }
}

