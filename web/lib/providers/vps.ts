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

// API base URL for SFTP proxy
const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '/api')
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

  private getConfig(): VPSConfig {
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

    // Test connection via API
    const response = await fetch(`${API_BASE}/sftp/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include auth header if user is logged in
        ...(getAuthHeader()),
      },
      body: JSON.stringify(config),
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
    const config = this.getConfig()
    if (!config.id) return

    await fetch(`${API_BASE}/sftp/${config.id}`, {
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
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const response = await fetch(`${API_BASE}/sftp/${config.id}/quota`, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      throw new Error('Failed to get quota')
    }

    const data = await response.json()

    const used = data.used || 0
    const total = data.total || 0
    const free = total - used

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
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const path = options?.folderId || config.rootPath || '/'

    const response = await fetch(
      `${API_BASE}/sftp/${config.id}/files?path=${encodeURIComponent(path)}`,
      { headers: getAuthHeader() }
    )

    if (!response.ok) {
      throw new Error('Failed to list files')
    }

    const data = await response.json()
    const files: FileMetadata[] = (data.files || []).map((f: any) => this.mapFile(f, config.rootPath || '/'))

    return {
      files,
      hasMore: false,
    }
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const response = await fetch(
      `${API_BASE}/sftp/${config.id}/file?path=${encodeURIComponent(fileId)}`,
      { headers: getAuthHeader() }
    )

    if (!response.ok) {
      throw new Error('Failed to get file')
    }

    const data = await response.json()
    return this.mapFile(data, config.rootPath || '/')
  }

  /**
   * Upload file via SFTP
   */
  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const folderPath = options?.folderId || config.rootPath || '/'
    const fileName = options?.fileName || file.name
    const targetPath = folderPath === '/' ? `/${fileName}` : `${folderPath}/${fileName}`

    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', targetPath)

    const response = await fetch(`${API_BASE}/sftp/${config.id}/upload`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const data = await response.json()
    return this.mapFile(data, config.rootPath || '/')
  }

  /**
   * Download file via SFTP
   */
  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const response = await fetch(
      `${API_BASE}/sftp/${config.id}/download?path=${encodeURIComponent(fileId)}`,
      { headers: getAuthHeader() }
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
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const response = await fetch(
      `${API_BASE}/sftp/${config.id}/file?path=${encodeURIComponent(fileId)}`,
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
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const parentPath = parentId || config.rootPath || '/'
    const targetPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`

    const response = await fetch(`${API_BASE}/sftp/${config.id}/folder`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath }),
    })

    if (!response.ok) {
      throw new Error('Create folder failed')
    }

    const data = await response.json()
    return this.mapFile(data, config.rootPath || '/')
  }

  /**
   * Move/rename file via SFTP
   */
  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const fileName = fileId.split('/').pop()
    const newPath = newParentId === '/' ? `/${fileName}` : `${newParentId}/${fileName}`

    const response = await fetch(
      `${API_BASE}/sftp/${config.id}/move?from=${encodeURIComponent(fileId)}&to=${encodeURIComponent(newPath)}`,
      { method: 'POST', headers: getAuthHeader() }
    )

    if (!response.ok) {
      throw new Error('Move failed')
    }

    return this.getFile(newPath)
  }

  /**
   * Copy file via SFTP
   */
  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const config = this.getConfig()
    if (!config.id) throw new Error('Not connected')

    const fileName = fileId.split('/').pop()
    const newPath = newParentId === '/' ? `/${fileName}` : `${newParentId}/${fileName}`

    const response = await fetch(
      `${API_BASE}/sftp/${config.id}/copy?from=${encodeURIComponent(fileId)}&to=${encodeURIComponent(newPath)}`,
      { method: 'POST', headers: getAuthHeader() }
    )

    if (!response.ok) {
      throw new Error('Copy failed')
    }

    return this.getFile(newPath)
  }

  /**
   * Rename file via SFTP
   */
  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    const parts = fileId.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`

    return this.moveFile(fileId, newPath)
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

  private mapFile(item: any, rootPath: string): FileMetadata {
    const isFolder = item.isDir || item.isDirectory

    return {
      id: item.path,
      name: item.name,
      path: item.path,
      pathDisplay: item.path.replace(rootPath, '') || '/',
      size: item.size || 0,
      mimeType: isFolder ? 'application/vnd.folder' : getMimeType(item.name),
      isFolder,
      createdTime: item.createdTime,
      modifiedTime: item.modifiedTime || item.modTime,
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

// Export
export const vpsProvider = new VPSProvider()
