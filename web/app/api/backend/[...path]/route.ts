import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { resolveServerApiBase } from '@/lib/auth/serverApiBase'

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params
  const apiBase = resolveServerApiBase()
  const upstreamUrl = new URL(`${apiBase}/${path.join('/')}`)
  const requestUrl = new URL(request.url)
  upstreamUrl.search = requestUrl.search

  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const authHeaderFromRequest = request.headers.get('authorization')
  const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)

  if (!authHeader) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const requestHeaders = new Headers()
  const contentType = request.headers.get('content-type')
  const accept = request.headers.get('accept')
  const contentLength = request.headers.get('content-length')
  const range = request.headers.get('range')

  if (contentType) requestHeaders.set('content-type', contentType)
  if (accept) requestHeaders.set('accept', accept)
  if (contentLength) requestHeaders.set('content-length', contentLength)
  if (range) requestHeaders.set('range', range)
  requestHeaders.set('authorization', authHeader)

  const method = request.method
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : new Uint8Array(await request.arrayBuffer())

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: requestHeaders,
    body,
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'content-disposition',
    'content-range',
    'accept-ranges',
  ]

  for (const header of passthroughHeaders) {
    const value = upstream.headers.get(header)
    if (value) responseHeaders.set(header, value)
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context)
}
