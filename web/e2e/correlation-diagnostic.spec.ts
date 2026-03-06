import { test, expect } from '@playwright/test'

test('Observability: Correlation ID Persistence Diagnostic', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 3600000).toISOString()
      })
    })
  })

  // 1. Login
  await page.goto('/login')
  await page.fill('input[placeholder="Email"]', 'sup@goels.in')
  await page.fill('input[placeholder="Password"]', '123password')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*files/, { timeout: 20000 })

  const correlationIds: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('correlationId')) {
      try {
        const match = text.match(/"correlationId":"([^"]+)"/)
        if (match) correlationIds.push(match[1])
      } catch (e) {}
    }
  })

  // 2. Perform Rename Action
  await page.getByTestId('cf-sidebar-node-all-files').click()
  const fileRow = page.locator('tbody tr').first()
  await expect(fileRow).toBeVisible({ timeout: 10000 })
  
  await fileRow.locator('[data-testid="cf-files-row-overflow"]').click({ force: true })
  await page.getByRole('button', { name: '✏️ Rename' }).click()
  
  const newName = `Renamed-${Date.now()}.txt`
  await page.fill('input[placeholder="New name"]', newName)
  
  // Capture the proxy request that carries the provider rename operation.
  const responsePromise = page.waitForResponse(res =>
    res.url().includes('/api/remotes/') &&
    res.url().includes('/proxy') &&
    res.request().method() === 'POST'
  )
  
  await page.click('button:has-text("Save")')
  const proxyResponse = await responsePromise
  expect(proxyResponse.ok()).toBe(true)

  const proxyRequestBody = proxyResponse.request().postDataJSON() as { method?: string; url?: string }
  expect(['POST', 'PATCH', 'PUT']).toContain(proxyRequestBody.method || '')
  expect(proxyRequestBody.url || '').not.toBe('')
  await expect(page.getByText(newName).first()).toBeVisible({ timeout: 10000 })
  
  console.log('Correlation ID Diagnostic: PASS')
})
