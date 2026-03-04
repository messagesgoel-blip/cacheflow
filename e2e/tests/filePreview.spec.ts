import { test, expect } from '@playwright/test'

/**
 * File Preview E2E Tests
 * Task: 2.8
 * Gate: PREVIEW-1
 * 
 * Verifies that supported file types (image, pdf) show previews
 * and unsupported types show a fallback message.
 */

test.describe('File Browser - File Preview', () => {
  
  test.beforeEach(async ({ page }) => {
    // Intercept health check to ensure API is "up"
    await page.route('**/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' })
      })
    })

    // Mock connections to only show Local Storage
    await page.route('**/api/connections', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'local-1',
              provider: 'local',
              accountName: 'Local Storage',
              accountEmail: 'local-storage',
              status: 'connected'
            }
          ]
        })
      })
    })

    // Mock file browsing for the local provider
    await page.route('**/api/files/browse*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          folders: [],
          files: [
            {
              id: 'file-image-1',
              name: 'test-image.png',
              path: '/test-image.png',
              size_bytes: '1024',
              mime_type: 'image/png',
              created_at: '2026-03-04T12:00:00Z',
              updated_at: '2026-03-04T12:00:00Z'
            },
            {
              id: 'file-pdf-1',
              name: 'test-document.pdf',
              path: '/test-document.pdf',
              size_bytes: '2048',
              mime_type: 'application/pdf',
              created_at: '2026-03-04T12:00:00Z',
              updated_at: '2026-03-04T12:00:00Z'
            },
            {
              id: 'file-unsupported-1',
              name: 'test-archive.zip',
              path: '/test-archive.zip',
              size_bytes: '4096',
              mime_type: 'application/zip',
              created_at: '2026-03-04T12:00:00Z',
              updated_at: '2026-03-04T12:00:00Z'
            }
          ]
        })
      })
    })

    // Mock file download (preview trigger)
    await page.route('**/api/files/download', async route => {
      // Return a small transparent PNG for images, or dummy text for others
      const body = route.request().postDataJSON()?.id === 'file-image-1'
        ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
        : Buffer.from('dummy content')
        
      await route.fulfill({
        status: 200,
        contentType: route.request().postDataJSON()?.id === 'file-image-1' ? 'image/png' : 'application/octet-stream',
        body: body
      })
    })

    // Login and navigate to files
    await page.goto('/')
    
    // Check if we need to register or login
    const registerButton = page.locator('button:has-text("Need an account? Register")')
    if (await registerButton.isVisible()) {
      await registerButton.click()
    }

    await page.fill('input[placeholder="Email"]', `test-preview-${Date.now()}@example.com`)
    await page.fill('input[placeholder="Password"]', 'TestPassword123!')
    await page.click('button:has-text("Register")')

    // Wait for the redirect to /files
    await page.waitForURL(/.*files/, { timeout: 20000 }).catch(() => page.goto('/files'))
    
    // Ensure "Local Storage" is selected
    const localStorageTab = page.locator('button', { hasText: 'Local Storage' })
    await localStorageTab.click()
    
    // Wait for files to appear
    await expect(page.locator('text=test-image.png')).toBeVisible()
  })

  test('Supported image preview should show the image', async ({ page }) => {
    // Click on the image file row
    await page.click('text=test-image.png')

    // Verify preview panel is visible
    const previewPanel = page.locator('[data-testid="cf-preview-panel"]')
    await expect(previewPanel).toBeVisible()

    // Verify image is visible in preview area
    const previewImg = previewPanel.locator('img')
    await expect(previewImg).toBeVisible()
    
    // Verify metadata
    await expect(page.locator('[data-testid="cf-preview-metadata-name"]')).toHaveText('test-image.png')
    await expect(page.locator('[data-testid="cf-preview-metadata-size"]')).toHaveText('1 KB')
  })

  test('Supported PDF preview should show PDF placeholder', async ({ page }) => {
    // Click on the PDF file row
    await page.click('text=test-document.pdf')

    // Verify preview panel is visible
    const previewPanel = page.locator('[data-testid="cf-preview-panel"]')
    await expect(previewPanel).toBeVisible()

    // Verify PDF placeholder text
    await expect(previewPanel.locator('text=PDF Document')).toBeVisible()
    
    // Verify metadata
    await expect(page.locator('[data-testid="cf-preview-metadata-name"]')).toHaveText('test-document.pdf')
    await expect(page.locator('[data-testid="cf-preview-metadata-size"]')).toHaveText('2 KB')
  })

  test('Unsupported file type should show fallback message', async ({ page }) => {
    // Click on the zip file row
    await page.click('text=test-archive.zip')

    // Verify preview panel is visible
    const previewPanel = page.locator('[data-testid="cf-preview-panel"]')
    await expect(previewPanel).toBeVisible()

    // Verify fallback message
    await expect(previewPanel.locator('text=Preview not available')).toBeVisible()
    
    // Verify metadata
    await expect(page.locator('[data-testid="cf-preview-metadata-name"]')).toHaveText('test-archive.zip')
    await expect(page.locator('[data-testid="cf-preview-metadata-size"]')).toHaveText('4 KB')
  })

  test('Preview panel should be closable', async ({ page }) => {
    // Open preview
    await page.click('text=test-image.png')
    const previewPanel = page.locator('[data-testid="cf-preview-panel"]')
    await expect(previewPanel).toBeVisible()

    // Click close button
    await page.click('[data-testid="cf-preview-close"]')

    // Verify preview panel is hidden
    await expect(previewPanel).not.toBeVisible()
  })

  test('Preview panel actions should be visible', async ({ page }) => {
    await page.click('text=test-image.png')
    
    await expect(page.locator('[data-testid="cf-preview-action-download"]')).toBeVisible()
    await expect(page.locator('[data-testid="cf-preview-action-rename"]')).toBeVisible()
    await expect(page.locator('[data-testid="cf-preview-action-move"]')).toBeVisible()
    await expect(page.locator('[data-testid="cf-preview-action-copy"]')).toBeVisible()
    await expect(page.locator('[data-testid="cf-preview-action-delete"]')).toBeVisible()
  })

  test('Preview should not cause console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Open image preview
    await page.click('text=test-image.png')
    await expect(page.locator('[data-testid="cf-preview-panel"]')).toBeVisible()

    // Open PDF preview
    await page.click('text=test-document.pdf')
    await expect(page.locator('text=PDF Document')).toBeVisible()

    // Assert no console errors
    expect(consoleErrors).toEqual([])
  })

  test('Clicking download in preview panel should trigger download API', async ({ page }) => {
    // Intercept the download request
    let downloadTriggered = false
    await page.route('**/api/files/download', async route => {
      downloadTriggered = true
      await route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from('test content')
      })
    })

    await page.click('text=test-archive.zip')
    await page.click('[data-testid="cf-preview-action-download"]')

    // Wait for the request to be triggered
    await expect.poll(() => downloadTriggered).toBeTruthy()
  })
})
