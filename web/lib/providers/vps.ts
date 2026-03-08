/**
 * VPS/SFTP Provider Adapter
 * Connects to user's own Linux/VPS server via SFTP
 * This is the unique differentiator - no competitor supports this
 *
 * Note: SFTP requires server-side proxy due to SSH protocol
 * All file content streams through without persisting on OCI disk
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '')
  : ''

export interface VPSConfig {
  id?: string
  displayName: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKey?: string
  rootPath: string
}

export class VPSProvider extends StorageProvider {
  readonly id: ProviderId = 'vps'
  readonly name: string = 'VPS / SFTP'

  private config: VPSConfig | null = null

  constructor(config?: VPSConfig) {
    super()
    if (config) {
      this.setConfig(config)
    } else {
      this.loadConfig()
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  setConfig(config: VPSConfig): void {
    this.config = config
    if (typeof window === 'undefined') return
    // Store only non-sensitive config in localStorage
    const safeConfig = {
      id: config.id,
      displayName: config.displayName,
      host: config.host,
      port: config.port,
      username: config.username,
      authType: config.authType,
      rootPath: config.rootPath,
    }
    localStorage.setItem('cacheflow_vps_config', JSON.stringify(safeConfig))
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('cacheflow_vps_config')
    if (stored) {
      try {
        this.config = JSON.parse(stored)
      } catch (e) {
        console.error('[VPS] Failed to load config:', e)
      }
    }
  }

  private getConnectionId(): string {
    return this.config?.id || this.remoteId || ''
  }

  private getRootPath(): string {
    return this.config?.rootPath || '/'
  }

  private getConnectionApiPath(connectionId: string, suffix = ''): string {
    const base = API_BASE.replace(/\/+$/, '')
    const path = `/api/providers/vps/${encodeURIComponent(connectionId)}${suffix}`
    if (!base || base === '/api') return path
    return base.endsWith('/api') ? `${base}${path.replace(/^\/api/, '')}` : `${base}${path}`
  }

  private getConfig(): VPSConfig {
    if (!this.config && this.remoteId) {
      this.config = {
        id: this.remoteId,
        displayName: 'VPS / SFTP',
        host: '',
        port: 22,
        username: '',
        authType: 'key',
        rootPath: '/',
      }
    }

    if (!this.config) {
      throw new Error('VPS not configured. Call setConfig() first.')
    }
    return this.config
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Connect to VPS - tests connection and saves credentials
   */
  async connect(): Promise<ProviderToken> {
    const config = this.getConfig()
    if (config.authType !== 'key' || !config.privateKey) {
      throw new Error('VPS requires PEM key authentication')
    }

    const formData = new FormData()
    formData.append('label', config.displayName)
    formData.append('host', config.host)
    formData.append('port', String(config.port || 22))
    formData.append('username', config.username)
    formData.append(
      'pemFile',
      new File([config.privateKey], `${config.displayName || 'vps'}.pem`, {
        type: 'application/x-pem-file',
      }),
    )

    const response = await fetch(this.getConnectionApiPath('', '').replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        ...(getAuthHeader()),
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Connection failed' }))
      throw new Error(error.error || 'Failed to connect to VPS')
    }

    const data = await response.json()

    // Save config with returned ID
    this.setConfig({ ...config, id: data.id })

    const token: ProviderToken = {
      provider: 'vps',
      accessToken: data.id, // Use connection ID as token
      expiresAt: null, // VPS tokens don't expire
      accountEmail: config.username,
      displayName: config.displayName,
    }

    return token
  }

  /**
   * Disconnect - removes VPS connection
   */
  async disconnect(): Promise<void> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) return

    await fetch(this.getConnectionApiPath(connectionId), {
      method: 'DELETE',
      headers: getAuthHeader(),
    })

    this.config = null
    localStorage.removeItem('cacheflow_vps_config')
  }

  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    // VPS connections don't expire like OAuth
    return token
  }

  isTokenValid(token: ProviderToken | null): boolean {
    return token !== null && !!token.accessToken
  }

  // ===========================================================================
  // Quota
  // ===========================================================================

  /**
   * Get disk usage via SSH df command
   */
  async getQuota(): Promise<ProviderQuota> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const used = 0
    const total = 0
    const free = 0

    return {
      used,
      total,
      free,
      usedDisplay: formatBytes(used),
      totalDisplay: formatBytes(total),
      freeDisplay: formatBytes(free),
      percentUsed: total > 0 ? (used / total) * 100 : 0,
    }
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * List files via SFTP
   */
  async listFiles(options?: { folderId?: string; pageSize?: number }): Promise<ListFilesResult> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const path = options?.folderId || this.getRootPath()

    const response = await fetch(
      this.getConnectionApiPath(connectionId, `/files?path=${encodeURIComponent(path)}`),
      { headers: getAuthHeader() }
    )

    if (!response.ok) {
      throw new Error('Failed to list files')
    }

    const data = await response.json()
    const entries = Array.isArray(data) ? data : (data.files || [])
    const files: FileMetadata[] = entries.map((f: any) => this.mapFile(f, this.getRootPath(), path))

    return {
      files,
      hasMore: false,
    }
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    const normalizedPath = normalizeRemotePath(fileId)
    const parentPath = getParentPath(normalizedPath)
    const result = await this.listFiles({ folderId: parentPath })
    const file = result.files.find((entry) => entry.path === normalizedPath)
    if (!file) {
      throw new Error('Failed to get file')
    }
    return file
  }

  /**
   * Upload file via SFTP
   */
  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const folderPath = options?.folderId || this.getRootPath()
    const fileName = options?.fileName || file.name
    const targetPath = joinRemotePath(folderPath, fileName)

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(this.getConnectionApiPath(connectionId, `/files/upload?path=${encodeURIComponent(targetPath)}`), {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    return this.mapFile(
      {
        name: fileName,
        path: targetPath,
        type: 'file',
        size: file.size,
        modifiedAt: new Date().toISOString(),
      },
      this.getRootPath(),
      folderPath,
    )
  }

  /**
   * Download file via SFTP
   */
  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const headers: Record<string, string> = {
      ...getAuthHeader(),
    }
    if (typeof options?.range?.start === 'number') {
      headers.Range = `bytes=${options.range.start}-${typeof options.range.end === 'number' ? options.range.end : ''}`
    }

    const response = await fetch(
      this.getConnectionApiPath(connectionId, `/files/download?path=${encodeURIComponent(fileId)}`),
      { headers }
    )

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    return response.blob()
  }

  /**
   * Delete file via SFTP
   */
  async deleteFile(fileId: string): Promise<void> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const response = await fetch(
      this.getConnectionApiPath(connectionId, `/files?path=${encodeURIComponent(fileId)}`),
      { method: 'DELETE', headers: getAuthHeader() }
    )

    if (!response.ok) {
      throw new Error('Delete failed')
    }
  }

  /**
   * Create folder via SFTP
   */
  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const parentPath = parentId || this.getRootPath()
    const targetPath = joinRemotePath(parentPath, name)

    const response = await fetch(this.getConnectionApiPath(connectionId, `/files/mkdir?path=${encodeURIComponent(targetPath)}`), {
      method: 'POST',
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      throw new Error('Create folder failed')
    }

    return this.mapFile(
      {
        name,
        path: targetPath,
        type: 'dir',
        size: 0,
        modifiedAt: new Date().toISOString(),
      },
      this.getRootPath(),
      parentPath,
    )
  }

  /**
   * Move/rename file via SFTP
   */
  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const existing = await this.getFile(fileId).catch(() => null)
    const targetPath = joinRemotePath(newParentId || this.getRootPath(), getFileName(fileId))
    const response = await fetch(this.getConnectionApiPath(connectionId, '/files/move'), {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourcePath: fileId,
        destinationPath: targetPath,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Move failed' }))
      throw new Error(error.detail || error.error || 'Move failed')
    }

    return this.mapFile(
      {
        name: getFileName(targetPath),
        path: targetPath,
        type: existing?.isFolder ? 'dir' : 'file',
        size: existing?.size || 0,
        modifiedAt: new Date().toISOString(),
      },
      this.getRootPath(),
      newParentId || this.getRootPath(),
    )
  }

  /**
   * Copy file via SFTP
   */
  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const existing = await this.getFile(fileId).catch(() => null)
    const targetPath = joinRemotePath(newParentId || this.getRootPath(), getFileName(fileId))
    const response = await fetch(this.getConnectionApiPath(connectionId, '/files/copy'), {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourcePath: fileId,
        destinationPath: targetPath,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Copy failed' }))
      throw new Error(error.detail || error.error || 'Copy failed')
    }

    return this.mapFile(
      {
        name: getFileName(targetPath),
        path: targetPath,
        type: existing?.isFolder ? 'dir' : 'file',
        size: existing?.size || 0,
        modifiedAt: new Date().toISOString(),
      },
      this.getRootPath(),
      newParentId || this.getRootPath(),
    )
  }

  /**
   * Rename file via SFTP
   */
  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    this.getConfig()
    const connectionId = this.getConnectionId()
    if (!connectionId) throw new Error('Not connected')

    const existing = await this.getFile(fileId).catch(() => null)
    const response = await fetch(this.getConnectionApiPath(connectionId, '/files/rename'), {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: fileId,
        newName,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Rename failed' }))
      throw new Error(error.detail || error.error || 'Rename failed')
    }

    const renamedPath = joinRemotePath(getParentPath(fileId), newName)
    return this.mapFile(
      {
        name: newName,
        path: renamedPath,
        type: existing?.isFolder ? 'dir' : 'file',
        size: existing?.size || 0,
        modifiedAt: new Date().toISOString(),
      },
      this.getRootPath(),
      getParentPath(renamedPath),
    )
  }

  // ===========================================================================
  // Sharing (Not supported for VPS)
  // ===========================================================================

  async getShareLink(fileId: string): Promise<string | null> {
    // VPS doesn't have built-in sharing
    return null
  }

  async revokeShareLink(fileId: string): Promise<void> {
    // Not supported
  }

  // ===========================================================================
  // Search (Client-side filtering)
  // ===========================================================================

  async searchFiles(options: { query: string; pageSize?: number }): Promise<SearchResult> {
    // Search is limited - list root and filter client-side
    // For better search, we'd need server-side implementation
    const result = await this.listFiles({ pageSize: options.pageSize || 100 })
    const query = options.query.toLowerCase()

    const filtered = result.files.filter(f =>
      f.name.toLowerCase().includes(query)
    )

    return {
      files: filtered,
      hasMore: false,
    }
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  getIcon(): string {
    return '🖥️'
  }

  getColor(): string {
    return '#10B981'
  }

  getFreeStorageGB(): number {
    return 0 // Varies by server
  }

  validateConfig(config: VPSConfig): { valid: boolean; error?: string } {
    if (!config.host) return { valid: false, error: 'Host is required' }
    if (!config.username) return { valid: false, error: 'Username is required' }
    if (!config.authType) return { valid: false, error: 'Auth type is required' }
    if (config.authType === 'password' && !config.password) {
      return { valid: false, error: 'Password is required for password auth' }
    }
    if (config.authType === 'key' && !config.privateKey) {
      return { valid: false, error: 'Private key is required for key auth' }
    }
    return { valid: true }
  }

  private mapFile(item: any, rootPath: string, currentPath = rootPath): FileMetadata {
    const isFolder = item.isDir || item.isDirectory || item.type === 'dir'
    const path = normalizeRemotePath(item.path || item.fullPath || joinRemotePath(currentPath, item.name || ''))

    return {
      id: path,
      name: item.name || path.split('/').pop() || path,
      path,
      pathDisplay: path.replace(rootPath, '') || '/',
      size: item.size || 0,
      mimeType: isFolder ? 'application/vnd.folder' : getMimeType(item.name || path),
      isFolder,
      createdTime: item.createdTime,
      modifiedTime: item.modifiedTime || item.modTime || item.modifiedAt || new Date().toISOString(),
      provider: 'vps',
      providerName: 'VPS / SFTP',
    }
  }
}

// Helper functions
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('cf_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    zip: 'application/zip',
    txt: 'text/plain',
    js: 'text/javascript',
    ts: 'text/typescript',
    json: 'application/json',
    html: 'text/html',
    css: 'text/css',
  }
  return types[ext || ''] || 'application/octet-stream'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function normalizeRemotePath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function joinRemotePath(basePath: string, name: string): string {
  const normalizedBase = normalizeRemotePath(basePath)
  if (normalizedBase === '/') return `/${name}`
  return `${normalizedBase.replace(/\/+$/, '')}/${name}`
}

function getParentPath(path: string): string {
  const normalized = normalizeRemotePath(path).replace(/\/+$/, '')
  if (normalized === '' || normalized === '/') return '/'
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

function getFileName(path: string): string {
  const normalized = normalizeRemotePath(path).replace(/\/+$/, '')
  const index = normalized.lastIndexOf('/')
  return index === -1 ? normalized : normalized.slice(index + 1)
}

// Export
export const vpsProvider = new VPSProvider()
