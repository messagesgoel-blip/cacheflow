/**
 * Localhost QA Baseline
 * Reviewed by QA Watcher: 2026-03-04
 * Status: Passing preflight, but blocked by UI Hang regression in downstream suites.
 */

import { test, expect } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('localhost login and tab navigation', async ({ page }, testInfo) => {
  const id = runId(testInfo.workerIndex)

  // Mock auth session endpoint
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        accessToken: 'test-token',
        user: { id: 'user-123', email: 'sup@goels.in' },
        expires: new Date(Date.now() + 3600000).toISOString(),
      }),
    })
  })

  // Mock auth refresh endpoint
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'test-token-refreshed',
        expiresIn: 3600,
      }),
    })
  })

  // Mock provider listing endpoints to prevent 401s
  await page.route('**/api/providers**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Mock files listing to prevent 401s
  await page.route('**/api/files**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: [], folders: [] }),
    })
  })

  // Mock connections endpoint
  await page.route('**/api/connections**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Mock any remaining API calls that might 401
  await page.route('**/api/**', async (route) => {
    // Only intercept if not already handled
    const url = route.request().url()
    if (url.includes('/api/auth/') || url.includes('/api/providers') ||
        url.includes('/api/files') || url.includes('/api/connections')) {
      return route.fallback()
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.context().addCookies([{
    name: 'accessToken',
    value: 'test-token',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])

  // Browser console should not show SW 404 or CORS errors
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/files')

  // Shell shows navigation elements
  await expect(page.getByRole('link', { name: /files/i }).first()).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: shotPath(id, 'post_login_shell'), fullPage: true })

  await page.getByRole('link', { name: /files/i }).first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'files_tab'), fullPage: true })

  // Navigate to cloud drives (connections page)
  const cloudDrivesLink = page.getByRole('link', { name: /your drives|cloud drives|connections|drives/i }).first()
  if (await cloudDrivesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cloudDrivesLink.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: shotPath(id, 'cloud_drives_tab'), fullPage: true })
  }

  // Navigate to settings
  await page.goto('/settings')
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'settings_tab'), fullPage: true })

  const noisy = consoleErrors.filter((e) => /sw\.js|access-control-allow-origin|cors/i.test(e))
  expect(noisy, `Console has CORS/SW noise:\n${noisy.join('\n')}`).toEqual([])
})
