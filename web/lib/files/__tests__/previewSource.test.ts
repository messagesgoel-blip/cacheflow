import type { FileMetadata } from '@/lib/providers/types'
import { buildTextPreviewRequest, resolveDirectPreviewUrl, TEXT_PREVIEW_BYTES } from '../previewSource'

function createFile(overrides: Partial<FileMetadata> = {}): FileMetadata {
  return {
    id: '/srv/storage/local/mock run/readme.txt',
    name: 'readme.txt',
    path: '/srv/storage/local/mock run/readme.txt',
    pathDisplay: '/srv/storage/local/mock run/readme.txt',
    size: 128,
    mimeType: 'text/plain',
    isFolder: false,
    modifiedTime: '2026-03-07T00:00:00.000Z',
    provider: 'vps',
    providerName: 'VPS / SFTP',
    ...overrides,
  }
}

describe('previewSource', () => {
  test('builds a direct preview url for VPS files', () => {
    const file = createFile({ accountKey: 'conn-1' } as any)

    expect(resolveDirectPreviewUrl(file)).toBe(
      '/api/providers/vps/conn-1/files/download?path=%2Fsrv%2Fstorage%2Flocal%2Fmock%20run%2Freadme.txt',
    )
  })

  test('builds a ranged text preview request for VPS files', () => {
    const file = createFile({ accountKey: 'conn-1' } as any)

    expect(buildTextPreviewRequest(file, { token: 'test-token' })).toEqual({
      url: '/api/providers/vps/conn-1/files/download?path=%2Fsrv%2Fstorage%2Flocal%2Fmock%20run%2Freadme.txt',
      init: {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: 'Bearer test-token',
          Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}`,
        },
      },
    })
  })

  test('builds a ranged text preview request for local files', () => {
    const file = createFile({
      id: 'file-1',
      path: '/mock/run/readme.txt',
      pathDisplay: '/mock/run/readme.txt',
      provider: 'local',
      providerName: 'Local Storage',
    })

    expect(buildTextPreviewRequest(file, { token: 'test-token', byteCount: 4096 })).toEqual({
      url: '/api/files/download',
      init: {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
          Range: 'bytes=0-4095',
        },
        body: JSON.stringify({ id: 'file-1' }),
      },
    })
  })
})
