import type { FileMetadata } from '@/lib/providers/types'
import { buildNextBreadcrumbStack, buildStarterFileContent, buildStarterFileName } from '../UnifiedFileBrowser'

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

  test('builds starter file names with the expected extension', () => {
    expect(buildStarterFileName('notes', 'md')).toBe('notes.md')
    expect(buildStarterFileName('notes.md', 'md')).toBe('notes.md')
    expect(buildStarterFileName('', 'json')).toBe('data.json')
    expect(buildStarterFileName('index', 'ts')).toBe('index.ts')
    expect(buildStarterFileName('Component', 'tsx')).toBe('Component.tsx')
    expect(buildStarterFileName('styles', 'css')).toBe('styles.css')
    expect(buildStarterFileName('', 'xml')).toBe('document.xml')
  })

  test('returns starter file content for common templates', () => {
    expect(buildStarterFileContent('txt')).toBe('')
    expect(buildStarterFileContent('json')).toContain('{')
    expect(buildStarterFileContent('html')).toContain('<!doctype html>')
    expect(buildStarterFileContent('tsx')).toContain('return <div />')
    expect(buildStarterFileContent('css')).toContain('color-scheme')
    expect(buildStarterFileContent('xml')).toContain('<?xml')
  })
})
