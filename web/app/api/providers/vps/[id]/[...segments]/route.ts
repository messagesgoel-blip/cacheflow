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

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ id: string; segments: string[] }> }
) {
  const { id, segments } = await context.params
  if (!id || !Array.isArray(segments) || segments.length === 0) {
    return NextResponse.json({ error: 'Invalid VPS route' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  const apiBase = resolveServerApiBase()
  const query = request.nextUrl.search || ''
  const target = `${apiBase}/api/providers/vps/${encodeURIComponent(id)}/${segments.map(encodeURIComponent).join('/')}${query}`

  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase())
  const body = hasBody ? await request.arrayBuffer() : undefined

  const upstream = await fetch(target, {
    method: request.method,
    headers: buildForwardHeaders(request, accessToken),
    body,
    cache: 'no-store',
  })

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  if (contentType.includes('application/json')) {
    const payload = await upstream.json().catch(() => ({}))
    return NextResponse.json(payload, { status: upstream.status })
  }

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  const disposition = upstream.headers.get('content-disposition')
  if (disposition) headers.set('Content-Disposition', disposition)
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('Content-Length', contentLength)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; segments: string[] }> }
) {
  return proxyRequest(request, context)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; segments: string[] }> }
) {
  return proxyRequest(request, context)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; segments: string[] }> }
) {
  return proxyRequest(request, context)
}
