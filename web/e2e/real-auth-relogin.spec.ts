import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const EMAIL = process.env.PLAYWRIGHT_QA_EMAIL || 'admin@cacheflow.goels.in'
const PASSWORD = process.env.PLAYWRIGHT_QA_PASSWORD || 'admin123'
const OUT_DIR = '/srv/storage/screenshots/cacheflow/UI Test'

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function shot(page: any, name: string) {
  const p = path.join(OUT_DIR, `${ts()}-${name.replace(/[^a-z0-9-_]+/gi, '_')}.png`)
  await page.screenshot({ path: p, fullPage: true }).catch(() => {})
}

function emailLocator(page: any) {
  return page.locator('input[placeholder*="email" i], input[type="email"], input[name*="email" i], input[id*="email" i]').first()
}

function passwordLocator(page: any) {
  return page.locator('input[placeholder*="password" i], input[type="password"], input[name*="password" i], input[id*="password" i]').first()
}

async function login(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  let email = emailLocator(page)
  let password = passwordLocator(page)

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await email.count()) break
    const loginButton = page.getByRole('button', { name: /^log in$/i }).first()
    const loginLink = page.getByRole('link', { name: /^log in$/i }).first()
    if (await loginButton.count()) {
      await loginButton.click({ timeout: 7000 }).catch(() => {})
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(1200)
    } else if (await loginLink.count()) {
      await loginLink.click({ timeout: 7000 }).catch(() => {})
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(1200)
    } else {
      await page.goto('/?mode=login', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(800)
    }
    if (!await email.count()) {
      await page.goto('/?mode=login', { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(800)
    }
    email = emailLocator(page)
    password = passwordLocator(page)
  }

  await expect(email).toBeVisible({ timeout: 20_000 })
  await expect(password).toBeVisible({ timeout: 20_000 })
  await email.fill(EMAIL)
  await password.fill(PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/files|\/providers|\/remotes|\/$/, { timeout: 30000 })
  await page.goto('/files', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 30000 })
  await shot(page, 'relogin-after-login')
}

async function logout(page: any) {
  const candidates = [
    page.getByRole('button', { name: /logout|sign out/i }).first(),
    page.getByRole('link', { name: /logout|sign out/i }).first(),
    page.locator('[data-testid="cf-nav-logout"], [data-testid="logout-button"]').first(),
  ]

  let clicked = false
  for (const locator of candidates) {
    if (await locator.count().catch(() => 0)) {
      await locator.click({ timeout: 5000 }).catch(() => {})
      clicked = true
      break
    }
  }

  if (!clicked) {
    await page.goto('/files', { waitUntil: 'domcontentloaded' })
  }

  await page.waitForTimeout(1200)
  await page.getByText(/Please log in to browse your files/i).first().isVisible().catch(() => false)
  await shot(page, 'relogin-after-logout')
  // Session cookies can linger in this route state; clear and force login mode.
  await page.context().clearCookies()
  await page.goto('/?mode=login', { waitUntil: 'domcontentloaded' })
}

test('real site: logout and login again', async ({ page }) => {
  test.setTimeout(150_000)
  await login(page)
  await logout(page)
  await login(page)
  await shot(page, 'relogin-after-second-login')
})
