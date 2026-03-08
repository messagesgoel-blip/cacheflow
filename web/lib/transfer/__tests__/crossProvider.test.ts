import { StorageProvider, ListFilesResult, UploadOptions, DownloadOptions, SearchResult } from '../../providers/StorageProvider'
import { FileMetadata, ProviderToken, ProviderQuota, ProviderId } from '../../providers/types'
import { transferFileBetweenProviders } from '../crossProvider'

class MemoryProvider extends StorageProvider {
  readonly id: ProviderId
  readonly name: string
  private files: Map<string, FileMetadata & { content: Blob }>

  constructor(id: ProviderId, seed: FileMetadata & { content: Blob }) {
    super()
    this.id = id
    this.name = id
    this.files = new Map([[seed.id, seed]])
  }

  async connect(): Promise<ProviderToken> { throw new Error('not used') }
  async disconnect(): Promise<void> { return }
  async refreshToken(): Promise<ProviderToken> { throw new Error('not used') }
  isTokenValid(): boolean { return true }
  async getQuota(): Promise<ProviderQuota> { return { used: 0, total: 0, free: 0, usedDisplay: '0', totalDisplay: '0', freeDisplay: '0', percentUsed: 0 } }
  async listFiles(): Promise<ListFilesResult> { return { files: Array.from(this.files.values()), hasMore: false } }
  async getFile(fileId: string): Promise<FileMetadata> {
    const f = this.files.get(fileId)
    if (!f) throw new Error('not found')
    return f
  }
  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const id = `${this.id}-${Date.now()}`
    const meta: FileMetadata & { content: Blob } = {
      id,
      name: options?.fileName || file.name,
      path: `${options?.folderId || '/'}${options?.folderId ? '/' : ''}${options?.fileName || file.name}`,
      pathDisplay: `${options?.folderId || '/'}${options?.folderId ? '/' : ''}${options?.fileName || file.name}`,
      size: file.size,
      mimeType: file.type,
      isFolder: false,
      modifiedTime: new Date().toISOString(),
      provider: this.id,
      providerName: this.name,
      content: file,
    }
    this.files.set(id, meta)
    return meta
  }
  async downloadFile(fileId: string, _options?: DownloadOptions): Promise<Blob> {
    const f = this.files.get(fileId)
    if (!f) throw new Error('not found')
    return f.content
  }
  async deleteFile(fileId: string): Promise<void> { this.files.delete(fileId) }
  async createFolder(): Promise<FileMetadata> { throw new Error('not used') }
  async moveFile(): Promise<FileMetadata> { throw new Error('not used') }
  async copyFile(): Promise<FileMetadata> { throw new Error('not used') }
  async renameFile(): Promise<FileMetadata> { throw new Error('not used') }
  async getShareLink(): Promise<string | null> { return null }
  async revokeShareLink(): Promise<void> { return }
  async searchFiles(): Promise<SearchResult> { return { files: [], hasMore: false } }
}

describe('transferFileBetweenProviders', () => {
  test('copies file between providers and leaves source intact', async () => {
    const sourceFile: FileMetadata & { content: Blob } = {
      id: 'src-1',
      name: 'sample.txt',
      path: '/sample.txt',
      pathDisplay: '/sample.txt',
      size: 5,
      mimeType: 'text/plain',
      isFolder: false,
      modifiedTime: new Date().toISOString(),
      provider: 'google',
      providerName: 'google',
      content: new Blob(['hello'], { type: 'text/plain' }),
    }

    const src = new MemoryProvider('google', sourceFile)
    const dest = new MemoryProvider('onedrive', {
      ...sourceFile,
      id: 'seed',
      provider: 'onedrive',
      providerName: 'onedrive',
      content: new Blob(['seed'], { type: 'text/plain' }),
    })

    const uploaded = await transferFileBetweenProviders({
      source: src,
      target: dest,
      file: sourceFile,
      targetFolderId: '/',
      mode: 'copy',
    })

    expect(uploaded.provider).toBe('onedrive')
    expect(await src.getFile(sourceFile.id)).toBeTruthy()
    expect((await dest.listFiles()).files.some(f => f.id === uploaded.id)).toBe(true)
  })

  test('moves file between providers and deletes source', async () => {
    const sourceFile: FileMetadata & { content: Blob } = {
      id: 'src-2',
      name: 'photo.jpg',
      path: '/photo.jpg',
      pathDisplay: '/photo.jpg',
      size: 3,
      mimeType: 'image/jpeg',
      isFolder: false,
      modifiedTime: new Date().toISOString(),
      provider: 'google',
      providerName: 'google',
      content: new Blob(['img'], { type: 'image/jpeg' }),
    }

    const src = new MemoryProvider('google', sourceFile)
    const dest = new MemoryProvider('dropbox', {
      ...sourceFile,
      id: 'seed2',
      provider: 'dropbox',
      providerName: 'dropbox',
      content: new Blob(['seed2'], { type: 'text/plain' }),
    })

    const uploaded = await transferFileBetweenProviders({
      source: src,
      target: dest,
      file: sourceFile,
      targetFolderId: '/Photos',
      mode: 'move',
    })

    expect(uploaded.provider).toBe('dropbox')
    await expect(src.getFile(sourceFile.id)).rejects.toThrow()
  })
})

