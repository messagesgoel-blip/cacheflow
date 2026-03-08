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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 })
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('accessToken')?.value
    const apiBase = resolveServerApiBase()
    const upstream = await fetch(`${apiBase}/api/providers/vps/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildForwardHeaders(request, accessToken),
      cache: 'no-store',
    })

    const payload = await upstream.json().catch(() => ({}))
    return NextResponse.json(payload, { status: upstream.status })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to disconnect VPS provider' },
      { status: 500 }
    )
  }
}

