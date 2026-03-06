import { test, expect } from '@playwright/test'

const FORBIDDEN_KEYS = ['accessToken', 'refreshToken', 'password', 'pass', 'clientSecret']

function checkForSecrets(obj: any, path = '') {
  if (!obj || typeof obj !== 'object') return
  for (const key in obj) {
    const value = obj[key]
    const currentPath = path ? `${path}.${key}` : key
    if (FORBIDDEN_KEYS.some((fk) => key.toLowerCase() === fk.toLowerCase())) {
      throw new Error(`Security Leak: Found "${key}" at ${currentPath}`)
    }
    if (typeof value === 'object') checkForSecrets(value, currentPath)
  }
}

async function fetchFirstJson(page: any, candidates: string[]) {
  for (const candidate of candidates) {
    const response = await page.request.get(candidate, { failOnStatusCode: false })
    const contentType = response.headers()['content-type'] || ''
    const text = await response.text()
    if (!contentType.includes('json') || !text.trim()) {
      continue
    }

    try {
      const body = JSON.parse(text)
      return { candidate, response, body }
    } catch {
      // Try next candidate if payload is malformed.
      continue
    }
  }
  throw new Error(`No JSON response returned for candidates: ${candidates.join(', ')}`)
}

function extractConnections(body: any): any[] {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  if (Array.isArray(body?.data?.connections)) return body.data.connections
  return []
}

function proxyListRequest(provider: string): { method: string; url: string; body?: any } | null {
  switch (provider) {
    case 'google':
      return {
        method: 'GET',
        url: 'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name,mimeType,size,modifiedTime),nextPageToken',
      }
    case 'dropbox':
      return {
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/files/list_folder',
        body: { path: '', recursive: false, limit: 1, include_deleted: false },
      }
    case 'onedrive':
      return {
        method: 'GET',
        url: 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=1',
      }
    case 'box':
      return {
        method: 'GET',
        url: 'https://api.box.com/2.0/folders/0/items?limit=1&fields=id,name,type,size,modified_at,parent',
      }
    default:
      return null
  }
}

test.describe('Security Audit - Secret Leaks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Email"]', 'sup@goels.in')
    await page.fill('input[placeholder="Password"]', '123password')
    await page.click('button:has-text("Sign In")')

    // Auth can land on /files or /connections depending on session state.
    await page.waitForURL(/.*(files|connections)/, { timeout: 20000 })
    if (!page.url().includes('/files')) {
      await page.goto('/files')
    }
    await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  })

  test('Check /api/remotes for leaked secrets', async ({ page }) => {
    await page.goto('/connections')
    const { candidate, body } = await fetchFirstJson(page, ['/api/remotes', '/api/connections'])
    console.log('Auditing response from:', candidate)
    checkForSecrets(body)
  })

  test('Check /api/files for leaked secrets', async ({ page }) => {
    await page.goto('/files')

    const { body: connectionsBody } = await fetchFirstJson(page, ['/api/connections'])
    const connections = extractConnections(connectionsBody)
    const target = connections.find((c) => proxyListRequest(c.provider)) || null

    test.skip(!target, 'No supported provider connection found for file proxy audit')

    const proxyReq = proxyListRequest(target.provider)!
    const response = await page.request.post(`/api/remotes/${target.remoteId || target.id}/proxy`, {
      data: proxyReq,
      failOnStatusCode: false,
    })
    const text = await response.text()
    const contentType = response.headers()['content-type'] || ''
    expect(contentType, 'Proxy response should be JSON for security audit').toContain('json')
    expect(text.trim(), 'Proxy response body should not be empty').not.toBe('')

    const body = JSON.parse(text)
    console.log('Auditing response from:', `/api/remotes/${target.remoteId || target.id}/proxy`)
    checkForSecrets(body)
  })
})
