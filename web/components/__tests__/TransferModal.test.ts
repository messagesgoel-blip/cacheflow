import { buildInitialStack, getInitialVpsTargetPath } from '../TransferModal'
import type { FileMetadata } from '@/lib/providers/types'

describe('TransferModal VPS defaults', () => {
  function createFile(overrides: Partial<FileMetadata> = {}): FileMetadata {
    return {
      id: '/srv/storage/local/mock run/oci-root-note.txt',
      name: 'oci-root-note.txt',
      path: '/srv/storage/local/mock run/oci-root-note.txt',
      pathDisplay: '/srv/storage/local/mock run/oci-root-note.txt',
      size: 33,
      mimeType: 'text/plain',
      isFolder: false,
      modifiedTime: '2026-03-07T19:00:00.000Z',
      provider: 'vps',
      providerName: 'VPS / SFTP',
      ...overrides,
    }
  }

  test('uses the source parent path for VPS file transfers', () => {
    expect(getInitialVpsTargetPath(createFile())).toBe('/srv/storage/local/mock run')
  })

  test('falls back to the current folder when a VPS file path is incomplete', () => {
    expect(
      getInitialVpsTargetPath(
        createFile({
          id: 'readme.txt',
          path: '/readme.txt',
          pathDisplay: '/readme.txt',
        }),
        '/srv/storage/local/mock run',
      ),
    ).toBe('/srv/storage/local/mock run')
  })

  test('keeps folder paths intact for VPS folder transfers', () => {
    const folder = createFile({
      id: '/srv/storage/local/mock run/level-1',
      name: 'level-1',
      path: '/srv/storage/local/mock run/level-1',
      pathDisplay: '/srv/storage/local/mock run/level-1',
      isFolder: true,
      mimeType: 'application/vnd.folder',
      size: 0,
    })

    expect(getInitialVpsTargetPath(folder)).toBe('/srv/storage/local/mock run/level-1')
  })

  test('builds a navigable stack for VPS paths with spaces', () => {
    expect(buildInitialStack('vps', createFile())).toEqual([
      { id: '/', label: '/' },
      { id: '/srv', label: 'srv' },
      { id: '/srv/storage', label: 'storage' },
      { id: '/srv/storage/local', label: 'local' },
      { id: '/srv/storage/local/mock run', label: 'mock run' },
    ])
  })

  test('uses the current folder path when building a VPS stack from a root-relative file path', () => {
    expect(
      buildInitialStack(
        'vps',
        createFile({
          id: 'readme.txt',
          path: '/readme.txt',
          pathDisplay: '/readme.txt',
        }),
        '/srv/storage/local/mock run',
      ),
    ).toEqual([
      { id: '/', label: '/' },
      { id: '/srv', label: 'srv' },
      { id: '/srv/storage', label: 'storage' },
      { id: '/srv/storage/local', label: 'local' },
      { id: '/srv/storage/local/mock run', label: 'mock run' },
    ])
  })

  test('falls back to root for non-VPS providers', () => {
    expect(buildInitialStack('google', createFile())).toEqual([{ id: 'root', label: '/' }])
  })
})

