import { NextRequest, NextResponse } from 'next/server'

type UploadRouteContext = { params: Promise<{ uuid: string }> }

function legacyUnavailable(uuid: string) {
  return NextResponse.json(
    {
      success: false,
      error: `Legacy upload endpoint for remote ${uuid} is unavailable in the web runtime`,
    },
    { status: 501 },
  )
}

export async function POST(_request: NextRequest, context: UploadRouteContext) {
  const { uuid } = await context.params
  return legacyUnavailable(uuid)
}

export async function GET(_request: NextRequest, context: UploadRouteContext) {
  const { uuid } = await context.params
  return legacyUnavailable(uuid)
}

export async function PUT(_request: NextRequest, context: UploadRouteContext) {
  const { uuid } = await context.params
  return legacyUnavailable(uuid)
}
