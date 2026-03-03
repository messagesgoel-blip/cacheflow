import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

test.describe('2.8@PREVIEW-1: Rich Previews', () => {
  let token: string

  test.beforeEach(async ({ page, request }) => {
    const response = await request.post('http://localhost:8100/auth/login', {
      data: { email: 'sup@goels.in', password: '123password' }
    })
    const data = await response.json()
    token = data.token
    if (!token) throw new Error('Failed to get token via API login')

    await page.addInitScript((t) => {
      localStorage.setItem('cf_token', t)
      localStorage.setItem('cf_email', 'sup@goels.in')
    }, token)

    await page.goto('/files')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="cf-sidebar-root"]')).toBeVisible({ timeout: 15000 })
  })

  test('Image, Text, and Unsupported previews work correctly', async ({ page }) => {
    // 1. Upload files
    const txtFileName = `preview-text-${Date.now()}.txt`
    const txtFilePath = path.join(__dirname, txtFileName)
    const longText = 'This is a very long line of text that is specifically designed to overflow the container to test whether the text wrapping is working correctly.'.repeat(3)
    fs.writeFileSync(txtFilePath, longText)

    const pngFileName = 'preview-image.png'
    const pngFilePath = path.join(__dirname, pngFileName)
    fs.writeFileSync(pngFilePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'))
    
    const zipFileName = `preview-unsupported-${Date.now()}.zip`
    const zipFilePath = path.join(__dirname, zipFileName)
    fs.writeFileSync(zipFilePath, 'PK')

    try {
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.getByTestId('action-bar-upload').click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles([txtFilePath, pngFilePath, zipFilePath])

      await expect(page.locator(`text=${txtFileName}`).first()).toBeVisible({ timeout: 15000 })
      await expect(page.locator(`text=${pngFileName}`).first()).toBeVisible({ timeout: 15000 })
      await expect(page.locator(`text=${zipFileName}`).first()).toBeVisible({ timeout: 15000 })

      // 2. Test Image Preview
      await page.click(`text=${pngFileName}`)
      const previewPanel = page.locator('[data-testid="cf-preview-panel"]')
      await expect(previewPanel).toBeVisible()
      await expect(previewPanel.locator('img[alt="preview-image.png"]')).toBeVisible()
      console.log('Image preview verified.')

      // 3. Test Text Preview with Wrapping
      await page.click(`text=${txtFileName}`)
      await expect(previewPanel.locator('pre.whitespace-pre-wrap')).toBeVisible()
      const textContent = await previewPanel.locator('pre.whitespace-pre-wrap').innerText()
      expect(textContent).toBe(longText)
      console.log('Text preview and wrapping verified.')

      // 4. Test Unsupported Preview
      await page.click(`text=${zipFileName}`)
      await expect(previewPanel.locator('text="Preview not available"')).toBeVisible()
      await expect(previewPanel.locator('button:has-text("Download")')).toBeVisible()
      console.log('Unsupported preview verified.')

    } finally {
      // Cleanup
      if (fs.existsSync(txtFilePath)) fs.unlinkSync(txtFilePath)
      if (fs.existsSync(pngFilePath)) fs.unlinkSync(pngFilePath)
      if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath)
    }
  })
})
