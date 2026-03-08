import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { resolveServerApiBase } from './serverApiBase'

interface SessionPayload {
  id?: string | number
  userId?: string | number
  email?: string
}

interface SessionUser {
  id: string | number | null
  email: string
}

export interface ServerSession {
  authenticated: boolean
  user: SessionUser | null
}

function parseUserCookie(raw: string | undefined): SessionUser | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return {
      id: parsed?.id ?? parsed?.userId ?? null,
      email: parsed?.email ?? '',
    }
  } catch {
    return null
  }
}

export async function resolveServerSession(): Promise<ServerSession> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  const fallbackUser = parseUserCookie(cookieStore.get('userData')?.value)

  if (!accessToken) {
    return { authenticated: false, user: null }
  }

  const secret = process.env.JWT_SECRET
  if (secret) {
    try {
      const payload = verify(accessToken, secret) as SessionPayload
      return {
        authenticated: true,
        user: {
          id: payload?.id ?? payload?.userId ?? fallbackUser?.id ?? null,
          email: payload?.email ?? fallbackUser?.email ?? '',
        },
      }
    } catch {
      // Fall through to backend verification.
    }
  }

  try {
    const apiBase = resolveServerApiBase()
    const backendResponse = await fetch(`${apiBase}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (backendResponse.ok) {
      const payload = await backendResponse.json().catch(() => ({}))
      const user = payload?.user ?? payload ?? {}
      return {
        authenticated: true,
        user: {
          id: user?.id ?? user?.userId ?? fallbackUser?.id ?? null,
          email: user?.email ?? fallbackUser?.email ?? '',
        },
      }
    }
  } catch {
    // Treat backend verification failures as unauthenticated.
  }

  return { authenticated: false, user: null }
}

