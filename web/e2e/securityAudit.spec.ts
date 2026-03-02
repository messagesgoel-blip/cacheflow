import { test, expect } from '@playwright/test'

test.describe('Security Audit - Secret Leaks', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    await page.goto('/login')
    const email = `test-${Date.now()}@example.com`
    const password = 'TestPassword123!'

    await page.click('text=Need an account? Register')
    await page.fill('input[placeholder="Email"]', email)
    await page.fill('input[placeholder="Password"]', password)
    await page.click('button:has-text("Register")')

    await page.waitForURL(/.*files/, { timeout: 20_000 })
  })

  test('Check /api/remotes for leaked secrets', async ({ page }) => {
    // Intercept response
    const responsePromise = page.waitForResponse(r => /api\/remotes/.test(r.url()) && r.status() === 200, { timeout: 20000 })
    await page.goto('/remotes')
    const response = await responsePromise
    const body = await response.json()

    function checkForSecrets(obj: any, path = '') {
      if (!obj || typeof obj !== 'object') return
      for (const key in obj) {
        const value = obj[key]
        const currentPath = path ? `${path}.${key}` : key
        // Keys that must NEVER be leaked
        const forbiddenKeys = ['accessToken', 'refreshToken', 'password', 'pass', 'clientSecret']
        if (forbiddenKeys.some(fk => key.toLowerCase() === fk.toLowerCase())) {
           throw new Error(`Security Leak: Found "${key}" at ${currentPath}`)
        }
        if (typeof value === 'object') checkForSecrets(value, currentPath)
      }
    }
    checkForSecrets(body)
  })

  test('Check /api/files for leaked secrets', async ({ page }) => {
    const responsePromise = page.waitForResponse(r => /api\/files/.test(r.url()) && r.status() === 200, { timeout: 20000 })
    await page.goto('/files')
    const response = await responsePromise
    const body = await response.json()

    function checkForSecrets(obj: any, path = '') {
      if (!obj || typeof obj !== 'object') return
      for (const key in obj) {
        if (['accessToken', 'refreshToken', 'password', 'clientSecret'].includes(key)) {
          throw new Error(`Security Leak: Found "${key}" at ${path}.${key}`)
        }
        if (typeof obj[key] === 'object') checkForSecrets(obj[key], `${path}.${key}`)
      }
    }
    checkForSecrets(body)
  })
})
