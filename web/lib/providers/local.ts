/**
 * Local Storage Provider
 * Hits the backend API for files stored on the server disk
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult, ListFilesOptions, SearchOptions } from './StorageProvider'
import { FileMetadata, ProviderToken, ProviderQuota } from './types'
import { browseFiles, apiRenameFile, apiMoveFile, apiDownloadFile, uploadFile as apiUploadFile } from '../api'

export class LocalProvider extends StorageProvider {
  id = 'local' as const
  name = 'Local Storage'

  constructor() {
    super()
  }

  async connect(): Promise<ProviderToken> {
    // Already connected via main app token
    const token = localStorage.getItem('cf_token') || ''
    return {
      provider: 'local',
      accessToken: token,
      accountEmail: 'local-storage',
      displayName: 'Local Storage',
      expiresAt: null
    }
  }

  async disconnect(): Promise<void> {
    // Managed by main app logout
  }

  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    return token
  }

  isTokenValid(token: ProviderToken): boolean {
    return !!token.accessToken
  }

  async getQuota(): Promise<ProviderQuota> {
    return {
      used: 0,
      total: 0,
      free: 0,
      usedDisplay: '0 B',
      totalDisplay: '0 B',
      freeDisplay: '0 B',
      percentUsed: 0
    }
  }

  async listFiles(options?: ListFilesOptions): Promise<ListFilesResult> {
    try {
      const token = localStorage.getItem('cf_token') || ''
      if (!token) return { files: [], hasMore: false }
      
      const res = await browseFiles(options?.folderId || '/', token)
      
      const files: FileMetadata[] = [
        ...(res.folders || []).map((f: any) => ({
          id: f.path,
          name: f.name,
          path: f.path,
          pathDisplay: f.path,
          size: 0,
          mimeType: 'application/vnd.folder',
          isFolder: true,
          modifiedTime: new Date().toISOString(),
          provider: 'local' as const,
          providerName: 'Local Storage'
        })),
        ...(res.files || []).map((f: any) => ({
          id: f.id,
          name: (f.path || '').split('/').pop() || f.path || f.name || 'Unknown',
          path: f.path || '',
          pathDisplay: f.path || '',
          size: parseInt(f.size_bytes) || 0,
          mimeType: 'application/octet-stream',
          isFolder: false,
          createdTime: f.created_at,
          modifiedTime: f.updated_at,
          provider: 'local' as const,
          providerName: 'Local Storage'
        }))
      ]

      return {
        files,
        nextPageToken: undefined,
        hasMore: false
      }
    } catch (e: any) {
      console.warn('[LocalProvider] Failed to list files:', e.message)
      return { files: [], hasMore: false }
    }
  }

  async getFile(fileId: string): Promise<FileMetadata> {
    throw new Error('Not implemented')
  }

  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const token = localStorage.getItem('cf_token') || ''
    const res = await apiUploadFile(file, token, options?.folderId)
    
    // Convert to FileMetadata
    return {
      id: res.id,
      name: res.name || file.name,
      path: res.path || '',
      pathDisplay: res.path || '',
      size: file.size,
      mimeType: file.type,
      isFolder: false,
      modifiedTime: new Date().toISOString(),
      provider: 'local',
      providerName: 'Local Storage'
    }
  }

  async downloadFile(id: string, options?: DownloadOptions): Promise<Blob> {
    const token = localStorage.getItem('cf_token') || ''
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    if (typeof options?.range?.start === 'number') {
      headers.Range = `bytes=${options.range.start}-${typeof options.range.end === 'number' ? options.range.end : ''}`
    }
    const response = await this.proxyFetch(`/api/files/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id })
    })
    if (!response.ok) throw new Error('Download failed')
    return await response.blob()
  }

  async deleteFile(id: string): Promise<void> {
    const token = localStorage.getItem('cf_token') || ''
    const res = await this.proxyFetch(`/api/files/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Delete failed')
  }

  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    const token = localStorage.getItem('cf_token') || ''
    const res = await this.proxyFetch('/api/files/folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, parentPath: parentId || '/' })
    })
    if (!res.ok) throw new Error('Create folder failed')
    const data = await res.json()
    return {
      id: data.path,
      name: data.name,
      path: data.path,
      pathDisplay: data.path,
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: new Date().toISOString(),
      provider: 'local',
      providerName: 'Local Storage'
    }
  }

  async renameFile(id: string, newName: string): Promise<FileMetadata> {
    const token = localStorage.getItem('cf_token') || ''
    const data = await apiRenameFile(id, newName, token, this.getRequestCorrelationId())
    const f = data.data.file
    return {
      id: f.id,
      name: f.path.split('/').pop() || f.path,
      path: f.path,
      pathDisplay: f.path,
      size: parseInt(f.size_bytes) || 0,
      mimeType: 'application/octet-stream',
      isFolder: false,
      modifiedTime: f.updated_at,
      provider: 'local',
      providerName: 'Local Storage'
    }
  }

  async moveFile(id: string, pid: string): Promise<FileMetadata> {
    const token = localStorage.getItem('cf_token') || ''
    const data = await apiMoveFile(id, pid, token, this.getRequestCorrelationId())
    const f = data.data.file
    return {
      id: f.id,
      name: f.path.split('/').pop() || f.path,
      path: f.path,
      pathDisplay: f.path,
      size: parseInt(f.size_bytes) || 0,
      mimeType: 'application/octet-stream',
      isFolder: false,
      modifiedTime: f.updated_at,
      provider: 'local',
      providerName: 'Local Storage'
    }
  }

  async copyFile(id: string, pid: string): Promise<FileMetadata> {
    throw new Error('Copy not implemented for local storage')
  }

  async getShareLink(id: string): Promise<string | null> {
    const token = localStorage.getItem('cf_token') || ''
    const data = await this.proxyFetch('/api/share', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    }).then(res => res.json())
    
    if (!data.ok) return null
    return `${window.location.origin}${data.data.share_url}`
  }

  async revokeShareLink(id: string): Promise<void> {
    // Standardized API doesn't have revoke yet
  }

  async searchFiles(options: SearchOptions): Promise<SearchResult> {
    return { files: [], hasMore: false }
  }
}

export const localProvider = new LocalProvider()
