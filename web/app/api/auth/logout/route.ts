import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  const cookieOptions = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }

  response.cookies.set('accessToken', '', {
    httpOnly: true,
    ...cookieOptions,
  })

  response.cookies.set('refreshToken', '', {
    httpOnly: true,
    path: '/api/auth',
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    maxAge: 0,
  })

  response.cookies.set('userData', '', {
    httpOnly: false,
    ...cookieOptions,
  })

  for (const cookieName of ['sessionToken', 'totpSecret', 'totpBackupHashes', 'totpEnabled', 'totpLastUsed']) {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      ...cookieOptions,
    })
  }

  return response
}
