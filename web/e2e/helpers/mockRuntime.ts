import { APIRequestContext, expect, Page } from '@playwright/test'

export interface MockConnection {
  id: string
  remoteId?: string
  provider: string
  accountKey: string
  accountEmail: string
  accountLabel: string
  accountName?: string
  quota?: { used: number; total: number }
}

export interface MockFavorite {
  id: string
  provider: string
  account_key: string
  file_id: string
  file_name: string
  mime_type: string
  is_folder: boolean
  path: string
  created_at: string
}

export interface MockActivityItem {
  id: string
  action: string
  resource: string
  resource_id: string
  created_at: string
  metadata: Record<string, unknown>
}

export interface MockProxyRequest {
  remoteId: string
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
  jsonBody: unknown
}

export interface MockProxyResponse {
  status?: number
  headers?: Record<string, string>
  contentType?: string
  body?: string | Buffer
  json?: unknown
  delayMs?: number
}

interface MockRuntimeOptions {
  favorites?: MockFavorite[]
  activity?: MockActivityItem[]
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function defaultProxyResponse(request: MockProxyRequest): MockProxyResponse {
  if (request.url.includes('about?fields=storageQuota')) {
    return {
      json: {
        storageQuota: {
          usage: '1048576',
          limit: '1073741824',
        },
      },
    }
  }

  if (request.url.includes('/users/get_space_usage')) {
    return {
      json: {
        allocation: { allocated: 1073741824 },
        used: 1048576,
      },
    }
  }

  if (request.url.includes('/drive/v3/files') && request.url.includes('fields=size,mimeType')) {
    return {
      json: {
        size: '0',
        mimeType: 'text/plain',
      },
    }
  }

  if (request.url.includes('/drive/v3/files') && request.url.includes('alt=media')) {
    return {
      body: '',
      contentType: 'text/plain',
    }
  }

  if (request.url.includes('/drive/v3/files')) {
    return {
      json: {
        files: [],
        nextPageToken: null,
      },
    }
  }

  if (request.url.includes('/files/list_folder')) {
    return {
      json: {
        entries: [],
        has_more: false,
        cursor: 'mock-cursor',
      },
    }
  }

  if (request.url.includes('/files/get_metadata')) {
    return {
      json: {
        '.tag': 'file',
        id: 'id:mock',
        name: 'mock.txt',
        path_lower: '/mock.txt',
        path_display: '/mock.txt',
        size: 0,
      },
    }
  }

  return { json: {} }
}

export async function primeQaSession(
  page: Page,
  request: APIRequestContext,
  email = 'sup@goels.in',
  password = '123password',
  options: { mockOnly?: boolean } = {},
): Promise<void> {
  let token = 'mock-token'

  if (!options.mockOnly) {
    const response = await request
      .post('http://localhost:8100/auth/login', {
        data: { email, password },
      })
      .catch(() => null)

    if (response?.ok()) {
      const payload = await response.json()
      token = payload?.token || payload?.data?.token || token
    }
  }

  await page.context().addCookies([
    {
      name: 'accessToken',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'accessToken',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  await page.addInitScript(() => {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    sessionStorage.clear()
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'qa-user', email },
        expires: new Date(Date.now() + 3600000).toISOString(),
      }),
    })
  })
}

export async function installMockRuntime(
  page: Page,
  connections: MockConnection[],
  handleProxy: (request: MockProxyRequest) => MockProxyResponse | void | Promise<MockProxyResponse | void>,
  options: MockRuntimeOptions = {},
): Promise<void> {
  const favorites = [...(options.favorites || [])]
  const activity = [...(options.activity || [])]

  await page.addInitScript((mockConnections: MockConnection[]) => {
    const byProvider: Record<string, Array<Record<string, unknown>>> = {}

    for (const connection of mockConnections) {
      const remoteId = connection.remoteId || connection.id
      const token = {
        provider: connection.provider,
        accessToken: '',
        refreshToken: '',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        accountEmail: connection.accountEmail,
        displayName: connection.accountLabel,
        accountId: connection.accountKey,
        accountKey: connection.accountKey,
        disabled: false,
        remoteId,
      }

      byProvider[connection.provider] ||= []
      byProvider[connection.provider].push(token)
    }

    for (const [provider, tokens] of Object.entries(byProvider)) {
      localStorage.setItem(`cacheflow_tokens_${provider}`, JSON.stringify(tokens))
    }
  }, connections)

  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: connections,
      }),
    })
  })

  await page.route('**/api/remotes/*/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { status: 'connected', healthy: true },
      }),
    })
  })

  await page.route('**/api/favorites**', async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { favorites },
        }),
      })
      return
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, string | boolean>
      const favorite: MockFavorite = {
        id: `fav-${payload.fileId}`,
        provider: String(payload.provider),
        account_key: String(payload.accountKey),
        file_id: String(payload.fileId),
        file_name: String(payload.fileName),
        mime_type: String(payload.mimeType),
        is_folder: Boolean(payload.isFolder),
        path: String(payload.path),
        created_at: new Date().toISOString(),
      }

      const next = favorites.filter((item) => item.file_id !== favorite.file_id)
      next.push(favorite)
      favorites.splice(0, favorites.length, ...next)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { favorite },
        }),
      })
      return
    }

    if (method === 'DELETE') {
      const url = new URL(route.request().url())
      const fileId = url.pathname.split('/').pop() || ''
      const next = favorites.filter((item) => item.file_id !== fileId)
      favorites.splice(0, favorites.length, ...next)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'Unsupported favorites method' }),
    })
  })

  await page.route('**/api/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { activity },
      }),
    })
  })

  await page.route('**/api/remotes/*/proxy', async (route) => {
    const requestUrl = route.request().url()
    const remoteId = requestUrl.split('/api/remotes/')[1]?.split('/')[0] || ''
    const payload = route.request().postDataJSON() as Record<string, unknown>
    const proxyRequest: MockProxyRequest = {
      remoteId,
      method: String(payload?.method || 'GET'),
      url: String(payload?.url || ''),
      headers: (payload?.headers as Record<string, string>) || {},
      body: payload?.body,
      jsonBody: safeJsonParse(payload?.body),
    }

    const response = (await handleProxy(proxyRequest)) || defaultProxyResponse(proxyRequest)
    const fulfilled = response.json !== undefined
      ? JSON.stringify(response.json)
      : response.body !== undefined
        ? response.body
        : JSON.stringify({})

    if (response.delayMs) {
      await page.waitForTimeout(response.delayMs)
    }

    await route.fulfill({
      status: response.status || 200,
      headers: response.headers,
      contentType: response.contentType || (response.json !== undefined ? 'application/json' : 'text/plain'),
      body: fulfilled,
    })
  })
}

export async function gotoFilesAndWait(page: Page): Promise<void> {
  await page.goto('/files')
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
}
