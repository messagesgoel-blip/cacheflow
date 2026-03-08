import { test, expect } from '@playwright/test'
import { gotoFilesAndWait, installMockRuntime, primeQaSession, type MockConnection } from './helpers/mockRuntime'

const SHOTS_DIR = '/srv/storage/screenshots/cacheflow'

function runId(workerIndex: number): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-w${workerIndex}`
}

function shotPath(id: string, name: string): string {
  const safe = name.replace(/[^a-z0-9\-_.]+/gi, '_')
  return `${SHOTS_DIR}/${id}_${safe}.png`
}

test('files page loading/empty/loaded screenshots', async ({ page, request }, testInfo) => {
  const id = runId(testInfo.workerIndex)
  const connections: MockConnection[] = [
    {
      id: 'g1',
      remoteId: 'g1',
      provider: 'google',
      accountKey: 'g1',
      accountEmail: 'username@gmail.com',
      accountLabel: 'Google Drive A',
    },
  ]

  const loadedFiles = [
    {
      id: 'g-file-1',
      name: 'Hello.txt',
      parents: ['root'],
      mimeType: 'text/plain',
      size: '5',
      modifiedTime: new Date().toISOString(),
      createdTime: new Date().toISOString(),
    },
  ]

  let mode: 'loaded' | 'empty' = 'loaded'

  await primeQaSession(page, request)
  await installMockRuntime(page, connections, async ({ url }) => {
    if (url.includes('about?fields=storageQuota')) {
      return {
        json: {
          storageQuota: {
            usage: '1024',
            limit: '1048576',
          },
        },
      }
    }

    if (url.includes('drive/v3/files?') && !url.includes('fields=size,mimeType') && !url.includes('alt=media')) {
      if (mode === 'empty') {
        return {
          delayMs: 2000,
          json: {
            files: [],
            nextPageToken: null,
          },
        }
      }

      return {
        json: {
          files: loadedFiles,
          nextPageToken: null,
        },
      }
    }

    return { json: {} }
  })

  mode = 'empty'
  const loadingNavigation = page.goto('/files')
  await page.waitForTimeout(500)
  await page.screenshot({ path: shotPath(id, 'files_loading_state'), fullPage: true })
  await loadingNavigation
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await page.getByTestId('cf-sidebar-account-g1').click()

  await expect(page.getByText('This folder is empty')).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: shotPath(id, 'files_empty_state'), fullPage: true })

  mode = 'loaded'
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('CacheFlowMetadata')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })
  await page.reload()
  await expect(page.getByTestId('cf-sidebar-root')).toBeVisible({ timeout: 20000 })
  await page.getByTestId('cf-sidebar-account-g1').click()
  await page.getByTestId('files-refresh').click()
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 })
  await page.screenshot({ path: shotPath(id, 'files_loaded_state'), fullPage: true })
})

