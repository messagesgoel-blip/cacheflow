import { test, expect } from '@playwright/test'

test.describe('Security Audit - Secret Leaks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Email"]', 'sup@goels.in')
    await page.fill('input[placeholder="Password"]', '123password')
    await page.click('button:has-text("Sign In")')

    // Wait for the redirect to /files and ensure it's loaded
    await page.waitForURL(/.*files/, { timeout: 20000 })
    await expect(page.getByRole('link', { name: /files/i })).toBeVisible()
  })

  test('Check /api/remotes for leaked secrets', async ({ page }) => {
    // Navigate to remotes page
    await page.goto('/remotes')
    
    // Catch the API response
    const response = await page.waitForResponse(r => 
      r.url().includes('/remotes') && 
      !r.url().includes('_rsc') && 
      r.request().method() === 'GET' &&
      r.headers()['content-type']?.includes('json'),
      { timeout: 30000 }
    ).catch(async (e) => {
      console.log('Timed out waiting for remotes API. Current URL:', page.url())
      const token = await page.evaluate(() => localStorage.getItem('cf_token'))
      console.log('cf_token in localStorage:', token ? 'present' : 'MISSING')
      throw e
    })

    const body = await response.json()
    console.log('Auditing response from:', response.url())

    function checkForSecrets(obj: any, path = '') {
      if (!obj || typeof obj !== 'object') return
      for (const key in obj) {
        const value = obj[key]
        const currentPath = path ? `${path}.${key}` : key
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
    await page.goto('/files')
    
    const response = await page.waitForResponse(r => 
      r.url().includes('/files') && 
      !r.url().includes('_rsc') && 
      r.request().method() === 'GET' &&
      r.headers()['content-type']?.includes('json'),
      { timeout: 30000 }
    )

    const body = await response.json()
    console.log('Auditing response from:', response.url())

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
