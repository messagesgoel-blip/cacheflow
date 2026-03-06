import { test, expect } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

test.describe('2.8@PREVIEW-1: Rich Previews', () => {
  test('Image, Text, and Unsupported previews work correctly', async ({ page, request }) => {
    const longText = 'This is a very long line of text that is specifically designed to overflow the container to test whether the text wrapping is working correctly.'.repeat(3)
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')

    const connections: MockConnection[] = [
      {
        id: 'g1',
        remoteId: 'g1',
        provider: 'google',
        accountKey: 'g1',
        accountEmail: 'preview@example.com',
        accountLabel: 'Google Drive A',
      },
    ]

    const googleFiles = [
      {
        id: 'img-1',
        name: 'preview-image.png',
        mimeType: 'image/png',
        size: String(pngBuffer.length),
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
      },
      {
        id: 'txt-1',
        name: 'preview-text.txt',
        mimeType: 'text/plain',
        size: String(longText.length),
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
      },
      {
        id: 'zip-1',
        name: 'preview-unsupported.zip',
        mimeType: 'application/zip',
        size: '2',
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
      },
    ]

    await primeQaSession(page, request)
    await installMockRuntime(page, connections, async ({ url }) => {
      if (url.includes('about?fields=storageQuota')) {
        return {
          json: {
            storageQuota: {
              usage: '4096',
              limit: '1048576',
            },
          },
        }
      }

      if (url.includes('drive/v3/files?') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
        return {
          json: {
            files: googleFiles,
            nextPageToken: null,
          },
        }
      }

      const fileIdMatch = url.match(/drive\/v3\/files\/([^?]+)/)
      const fileId = fileIdMatch?.[1]
      const file = googleFiles.find((entry) => entry.id === fileId)
      if (!file) {
        return { json: {} }
      }

      if (url.includes('fields=size,mimeType')) {
        return {
          json: {
            size: file.size,
            mimeType: file.mimeType,
          },
        }
      }

      if (url.includes('alt=media')) {
        if (file.id === 'img-1') {
          return {
            body: pngBuffer,
            contentType: 'image/png',
          }
        }

        if (file.id === 'txt-1') {
          return {
            body: longText,
            contentType: 'text/plain',
          }
        }

        return {
          body: 'PK',
          contentType: 'application/zip',
        }
      }

      return { json: file }
    })

    await gotoFilesAndWait(page)
    await page.getByTestId('cf-sidebar-account-g1').click()

    await expect(page.getByText('preview-image.png').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('preview-text.txt').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('preview-unsupported.zip').first()).toBeVisible({ timeout: 15000 })

    await page.getByText('preview-image.png').first().click()
    const previewPanel = page.getByTestId('cf-preview-panel')
    await expect(previewPanel).toBeVisible()
    await expect(previewPanel.locator('img[alt="preview-image.png"]')).toBeVisible()
    await page.getByTestId('cf-preview-close').click()

    await page.getByText('preview-text.txt').first().click()
    await expect(previewPanel.locator('pre.whitespace-pre-wrap')).toBeVisible()
    await expect(previewPanel.locator('pre.whitespace-pre-wrap')).toContainText(longText)
    await page.getByTestId('cf-preview-close').click()

    await page.getByText('preview-unsupported.zip').first().click()
    await expect(previewPanel.getByText('Preview not available')).toBeVisible()
    await expect(page.getByTestId('cf-preview-action-download')).toBeVisible()
  })
})
