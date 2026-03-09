/**
 * Media Streaming Endpoint
 * 
 * Proxies file streaming from providers with HTTP Range support for seekable playback.
 * Supports video and audio streaming without full file download.
 * 
 * Gate: MEDIA-1, STREAM-1
 * Task: 6.4@Version-1
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveServerApiBase } from '@/lib/auth/serverApiBase'

type StreamRouteContext = { params: Promise<{ uuid: string }> }

interface StreamRequest {
  fileId: string
  provider: string
  path?: string
}

async function proxyMediaStream(
  request: NextRequest,
  uuid: string,
  rangeHeader: string | null
): Promise<NextResponse> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  const apiBase = resolveServerApiBase()

  const body = await request.text().catch(() => '')
  let streamReq: StreamRequest | null = null
  
  if (body) {
    try {
      streamReq = JSON.parse(body)
    } catch {
      const urlParams = new URLSearchParams(body)
      streamReq = {
        fileId: urlParams.get('fileId') || '',
        provider: urlParams.get('provider') || '',
        path: urlParams.get('path') || undefined,
      }
    }
  }

  const queryFileId = request.nextUrl.searchParams.get('fileId')
  const queryProvider = request.nextUrl.searchParams.get('provider')
  const queryPath = request.nextUrl.searchParams.get('path')

  const fileId = streamReq?.fileId || queryFileId || ''
  const provider = streamReq?.provider || queryProvider || ''
  const path = streamReq?.path || queryPath

  if (!fileId && !path) {
    return NextResponse.json(
      { success: false, error: 'File ID or path is required for streaming' },
      { status: 400 }
    )
  }

  const forwardHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    forwardHeaders['Authorization'] = `Bearer ${accessToken}`
  }

  if (rangeHeader) {
    forwardHeaders['Range'] = rangeHeader
  }

  let upstreamUrl: string
  let upstreamMethod = 'POST'

  if (provider === 'vps' || provider === 'local') {
    if (provider === 'local') {
      upstreamUrl = `${apiBase}/api/files/download`
      upstreamMethod = 'POST'
    } else {
      upstreamUrl = `${apiBase}/api/providers/vps/${encodeURIComponent(uuid)}/files/download`
      if (path) {
        upstreamUrl += `?path=${encodeURIComponent(path)}`
      }
      upstreamMethod = 'GET'
    }
  } else {
    upstreamUrl = `${apiBase}/api/remotes/${encodeURIComponent(uuid)}/proxy`
    upstreamMethod = 'POST'
  }

  try {
    let upstream: Response

    if (upstreamMethod === 'POST') {
      const requestBody: Record<string, string> = {}
      if (fileId) requestBody['id'] = fileId
      
      upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      })
    } else {
      upstream = await fetch(upstreamUrl, {
        method: 'GET',
        headers: forwardHeaders,
        cache: 'no-store',
      })
    }

    const responseHeaders = new Headers()
    
    const contentType = upstream.headers.get('content-type')
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges')

    if (contentType) responseHeaders.set('content-type', contentType)
    if (contentLength) responseHeaders.set('content-length', contentLength)
    if (contentRange) responseHeaders.set('content-range', contentRange)
    if (acceptRanges) responseHeaders.set('accept-ranges', acceptRanges)

    responseHeaders.set('Accept-Ranges', 'bytes')
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    responseHeaders.set('Pragma', 'no-cache')

    const status = upstream.status === 206 ? 206 : upstream.ok ? 200 : upstream.status

    return new NextResponse(upstream.body, {
      status,
      headers: responseHeaders,
    })
  } catch (err) {
    console.error('Media stream proxy error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to stream media' },
      { status: 502 }
    )
  }
}

export async function GET(request: NextRequest, context: StreamRouteContext) {
  const { uuid } = await context.params
  const rangeHeader = request.headers.get('range')
  return proxyMediaStream(request, uuid, rangeHeader)
}

export async function POST(request: NextRequest, context: StreamRouteContext) {
  const { uuid } = await context.params
  const rangeHeader = request.headers.get('range')
  return proxyMediaStream(request, uuid, rangeHeader)
}

export async function HEAD(request: NextRequest, context: StreamRouteContext) {
  const { uuid } = await context.params
  const rangeHeader = request.headers.get('range')
  const response = await proxyMediaStream(request, uuid, rangeHeader)
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  })
}
