import type { FileMetadata } from '@/lib/providers/types'
import { buildNextBreadcrumbStack } from '../UnifiedFileBrowser'

describe('UnifiedFileBrowser folder breadcrumbs', () => {
  function createFolder(overrides: Partial<FileMetadata> = {}): FileMetadata {
    return {
      id: '/tmp',
      name: 'tmp',
      path: '/tmp',
      pathDisplay: '/tmp',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-03-07T00:00:00.000Z',
      provider: 'vps',
      providerName: 'VPS / SFTP',
      ...overrides,
    }
  }

  test('rebuilds slash-based breadcrumbs instead of appending duplicates', () => {
    const stack = buildNextBreadcrumbStack(
      [
        { id: '/tmp', name: 'tmp' },
        { id: '/tmp/cache', name: 'cache' },
      ],
      createFolder(),
      '/tmp',
    )

    expect(stack).toEqual([{ id: '/tmp', name: 'tmp' }])
  })

  test('dedupes non-slash provider breadcrumb entries by id', () => {
    const folder = createFolder({
      id: 'box-folder-123',
      path: 'box-folder-123',
      pathDisplay: 'box-folder-123',
      provider: 'box',
      providerName: 'Box',
    })

    const stack = buildNextBreadcrumbStack(
      [{ id: 'box-folder-123', name: 'tmp' }],
      folder,
      'box-folder-123',
    )

    expect(stack).toEqual([{ id: 'box-folder-123', name: 'tmp' }])
  })
})

