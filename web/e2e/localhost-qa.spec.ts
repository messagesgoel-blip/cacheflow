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

  // Clean session
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  // Browser console should not show SW 404 or CORS errors
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/login')

  // Login with seeded user
  await page.getByRole('textbox', { name: /email/i }).fill('sup@goels.in')
  await page.getByRole('textbox', { name: /password/i }).fill('123password')
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Shell shows tabs
  await expect(page.getByRole('link', { name: /files/i })).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: shotPath(id, 'post_login_shell'), fullPage: true })

  await page.getByRole('link', { name: /files/i }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'files_tab'), fullPage: true })

  await page.getByRole('link', { name: /cloud drives/i }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'cloud_drives_tab'), fullPage: true })

  await page.getByRole('link', { name: /conflicts/i }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'conflicts_tab'), fullPage: true })

  await page.getByRole('link', { name: /admin/i }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'admin_tab'), fullPage: true })

  await page.goto('/settings')
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath(id, 'settings_tab'), fullPage: true })

  const noisy = consoleErrors.filter((e) => /sw\.js|access-control-allow-origin|cors/i.test(e))
  expect(noisy, `Console has CORS/SW noise:\n${noisy.join('\n')}`).toEqual([])
})
