import { test } from '@playwright/test'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('basic pages screenshots', async ({ page }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  await page.context().addCookies([{
    name: 'accessToken',
    value: 'test-token',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'ui-shot-user', email: 'test@example.com' },
      }),
    })
  })

  await page.goto('/providers')
  await page.waitForTimeout(500)
  await page.screenshot({ path: shotPath(id, 'providers_page'), fullPage: true })

  await page.goto('/remotes')
  await page.waitForTimeout(500)
  await page.screenshot({ path: shotPath(id, 'remotes_page'), fullPage: true })

  await page.goto('/settings')
  await page.waitForTimeout(500)
  await page.screenshot({ path: shotPath(id, 'settings_page'), fullPage: true })
})
