import { VPSProvider } from '../vps'
import type { FileMetadata } from '../types'

describe('VPSProvider file operations', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('cf_token', 'test-token')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  function createProvider() {
    return new VPSProvider({
      id: 'conn-1',
      displayName: 'OCI',
      host: '40.233.74.160',
      port: 22,
      username: 'sanjay',
      authType: 'key',
      privateKey: 'pem',
      rootPath: '/',
    })
  }

  function mockFile(path: string): FileMetadata {
    return {
      id: path,
      name: path.split('/').pop() || 'file.txt',
      path,
      pathDisplay: path,
      size: 33,
      mimeType: 'text/plain',
      isFolder: false,
      modifiedTime: '2026-03-07T19:00:00.000Z',
      provider: 'vps',
      providerName: 'VPS / SFTP',
    }
  }

  test('moveFile posts source and destination paths to the VPS API', async () => {
    const provider = createProvider()
    jest.spyOn(provider, 'getFile').mockResolvedValue(mockFile('/srv/storage/local/mock run/oci-root-note.txt'))

    await provider.moveFile(
      '/srv/storage/local/mock run/oci-root-note.txt',
      '/srv/storage/local/mock run/level-1',
    )

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/providers/vps/conn-1/files/move',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          sourcePath: '/srv/storage/local/mock run/oci-root-note.txt',
          destinationPath: '/srv/storage/local/mock run/level-1/oci-root-note.txt',
        }),
      }),
    )
  })

  test('copyFile posts source and destination paths to the VPS API', async () => {
    const provider = createProvider()
    jest.spyOn(provider, 'getFile').mockResolvedValue(mockFile('/srv/storage/local/mock run/oci-root-note.txt'))

    await provider.copyFile(
      '/srv/storage/local/mock run/oci-root-note.txt',
      '/srv/storage/local/mock run/archive',
    )

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/providers/vps/conn-1/files/copy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sourcePath: '/srv/storage/local/mock run/oci-root-note.txt',
          destinationPath: '/srv/storage/local/mock run/archive/oci-root-note.txt',
        }),
      }),
    )
  })

  test('renameFile posts path and newName to the VPS API', async () => {
    const provider = createProvider()
    jest.spyOn(provider, 'getFile').mockResolvedValue(mockFile('/srv/storage/local/mock run/oci-root-note.txt'))

    await provider.renameFile('/srv/storage/local/mock run/oci-root-note.txt', 'oci-renamed.txt')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/providers/vps/conn-1/files/rename',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          path: '/srv/storage/local/mock run/oci-root-note.txt',
          newName: 'oci-renamed.txt',
        }),
      }),
    )
  })

  test('downloadFile forwards byte ranges to the VPS API', async () => {
    const provider = createProvider()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['preview']),
    } as Response)

    await provider.downloadFile('/srv/storage/local/mock run/readme.txt', {
      range: { start: 0, end: 65535 },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/providers/vps/conn-1/files/download?path=%2Fsrv%2Fstorage%2Flocal%2Fmock%20run%2Freadme.txt',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Range: 'bytes=0-65535',
        }),
      }),
    )
  })
})
