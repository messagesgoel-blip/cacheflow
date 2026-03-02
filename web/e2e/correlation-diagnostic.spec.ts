import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

test('Observability: Correlation ID Persistence Diagnostic', async ({ page }) => {
  // 1. Login
  await page.goto('http://localhost:3010/login')
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
  const fileRow = page.locator('tr').filter({ hasText: 'GOOGLE A.txt' }).first()
  await expect(fileRow).toBeVisible({ timeout: 10000 })
  
  await fileRow.locator('[data-testid="cf-files-row-overflow"]').click({ force: true })
  await page.getByText('Rename').click()
  
  const newName = `Renamed-${Date.now()}.txt`
  await page.fill('input[placeholder="Enter new name"]', newName)
  
  // Capture the network request
  const requestPromise = page.waitForRequest(req => 
    req.url().includes('/proxy') && req.method() === 'POST'
  )
  
  await page.click('button:has-text("Save")')
  const request = await requestPromise
  const headers = request.headers()
  const sentCorrelationId = headers['x-correlation-id']
  
  console.log('Sent Correlation ID:', sentCorrelationId)
  expect(sentCorrelationId).toBeDefined()
  
  // 3. Verify in Backend Audit Logs
  await page.waitForTimeout(2000) // Wait for audit log async write
  
  const dbResult = execSync(`docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -t -c "SELECT metadata FROM audit_logs WHERE action = 'rename' ORDER BY created_at DESC LIMIT 1;"`).toString().trim()
  console.log('DB Audit Metadata:', dbResult)
  
  const metadata = JSON.parse(dbResult)
  expect(metadata.correlationId).toBe(sentCorrelationId)
  
  console.log('Correlation ID Diagnostic: PASS')
})
