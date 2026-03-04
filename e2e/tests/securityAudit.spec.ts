import { test, expect } from '@playwright/test'

/**
 * Security Audit Test
 * Task: 1.19
 * Gate: AUTH-2
 * 
 * Verifies that no sensitive information (secrets, tokens, passwords) 
 * is leaked in API responses.
 */

test.describe('Security Audit - API Secret Leak Prevention', () => {
  
  // Login before each test to get a session
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Email"]', 'sup@goels.in')
    await page.fill('input[placeholder="Password"]', '123password')
    await page.click('button:has-text("Sign In")')

    // Wait for the redirect to /files or /dashboard
    await page.waitForURL(/.*(files|dashboard)/, { timeout: 20000 })
  })

  const FORBIDDEN_PATTERNS = [
    /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/, // JWT pattern
    /"accessToken":\s*"[^"]+"/,
    /"refreshToken":\s*"[^"]+"/,
    /"password":\s*"[^"]+"/,
    /"clientSecret":\s*"[^"]+"/,
    /"client_secret":\s*"[^"]+"/,
    /"secret":\s*"[^"]+"/,
    /"apiKey":\s*"[^"]+"/,
    /"api_key":\s*"[^"]+"/,
    /"privateKey":\s*"[^"]+"/,
    /"private_key":\s*"[^"]+"/,
  ]

  const FORBIDDEN_KEYS = [
    'accessToken',
    'refreshToken',
    'password',
    'clientSecret',
    'client_secret',
    'secret',
    'apiKey',
    'api_key',
    'privateKey',
    'private_key',
    'jwtSecret',
    'jwt_secret',
    'JWT_SECRET',
    'databaseUrl',
    'database_url',
    'DATABASE_URL',
  ]

  function checkForSecrets(obj: any, path = ''): string[] {
    const leaks: string[] = []
    if (!obj || typeof obj !== 'object') return leaks

    for (const key in obj) {
      const value = obj[key]
      const currentPath = path ? `${path}.${key}` : key

      // Check key name
      if (FORBIDDEN_KEYS.some(fk => key.toLowerCase() === fk.toLowerCase())) {
        // Exclude false positives if necessary (none known yet)
        leaks.push(`Forbidden key "${key}" found at ${currentPath}`)
      }

      // Check value if string
      if (typeof value === 'string') {
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
          leaks.push(`JWT-like string found at ${currentPath}`)
        }
        
        if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(value))) {
          leaks.push(`Pattern match for secret found at ${currentPath}`)
        }
      }

      // Recurse
      if (typeof value === 'object' && value !== null) {
        leaks.push(...checkForSecrets(value, currentPath))
      }
    }
    return leaks
  }

  const endpointsToAudit = [
    { name: 'Remotes', url: '/remotes', apiPattern: /\/api\/remotes/ },
    { name: 'Files', url: '/files', apiPattern: /\/api\/files/ },
    { name: 'Connections', url: '/connections', apiPattern: /\/api\/connections/ },
    { name: 'Settings', url: '/settings', apiPattern: /\/api\/settings/ },
  ]

  for (const endpoint of endpointsToAudit) {
    test(`Audit ${endpoint.name} API response for secrets`, async ({ page }) => {
      // Setup response interceptor
      const responsePromise = page.waitForResponse(r => 
        r.url().match(endpoint.apiPattern) && 
        r.request().method() === 'GET' &&
        r.headers()['content-type']?.includes('json')
      )

      await page.goto(endpoint.url)
      const response = await responsePromise
      const body = await response.json()

      console.log(`Auditing ${endpoint.name} API response...`)
      const leaks = checkForSecrets(body)
      
      if (leaks.length > 0) {
        throw new Error(`Security Audit Failed for ${endpoint.name}:\n${leaks.join('\n')}`)
      }
      
      expect(leaks.length).toBe(0)
    })
  }

  test('Check that database configuration is not leaked in /api/health or similar', async ({ page }) => {
    const response = await page.goto('/api/health').then(r => r?.json())
    if (response) {
      const leaks = checkForSecrets(response)
      expect(leaks.length, `Leaked secrets in health check: ${leaks.join(', ')}`).toBe(0)
    }
  })
})
