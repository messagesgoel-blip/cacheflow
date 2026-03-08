/**
 * WebDAV Provider Adapter
 * Supports generic WebDAV servers (Nextcloud, ownCloud, etc.)
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { formatBytes, formatMimeType } from './utils'

export interface WebDAVConfig {
  url: string
  username: string
  password: string
  // Optional: path prefix
  prefix?: string
}

export class WebDAVProvider extends StorageProvider {
  readonly id: ProviderId = 'webdav'
  readonly name: string = 'WebDAV'

  private config: WebDAVConfig | null = null

  constructor(config?: WebDAVConfig) {
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

  setConfig(config: WebDAVConfig): void {
    this.config = config
    if (typeof window === 'undefined') return
    // Store in localStorage for persistence
    localStorage.setItem('cacheflow_webdav_config', JSON.stringify(config))
  }

  private loadToken(): void {
    this.ensureActiveToken()
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('cacheflow_webdav_config')
    if (stored) {
      try {
        this.config = JSON.parse(stored)
      } catch (e) {
        console.error('[WebDAV] Failed to load config:', e)
      }
    }
  }

  private ensureActiveToken(): void {
    const token = tokenManager.getToken('webdav')
    if (token && token.accessToken) {
      // For WebDAV, accessToken IS the b64 credentials
      // displayName IS the url
      if (!this.config) {
        this.config = {
          url: token.displayName,
          username: token.accountEmail || '',
          password: '', // Password not stored separately in token
        }
      }
      this.accessToken = token.accessToken
    }
  }

  private accessToken: string | null = null

  private getConfig(): WebDAVConfig {
    if (!this.config) {
      throw new Error('WebDAV not configured. Call setConfig() first.')
    }
    return this.config
  }

  // ===========================================================================
  // Authentication (Basic Auth)
  // ===========================================================================

  /**
   * Connect to WebDAV server (test connection)
   */
  async connect(): Promise<ProviderToken> {
    const config = this.getConfig()

    // Test connection by PROPFIND request
    const response = await this.request('PROPFIND', '', {
      Depth: '0',
    })

    if (!response.ok && response.status !== 207) {
      throw new Error(`Failed to connect to WebDAV server: ${response.status}`)
    }

    // Create basic auth token
    const credentials = btoa(`${config.username}:${config.password}`)

    const token: ProviderToken = {
      provider: 'webdav',
      accessToken: credentials,
      expiresAt: null,
      accountEmail: config.username,
      displayName: config.url,
    }

    // Save token
    tokenManager.saveToken('webdav', token)

    return token
  }

  /**
   * Disconnect (clear credentials)
   */
  async disconnect(): Promise<void> {
    tokenManager.removeToken('webdav')
    this.config = null
    localStorage.removeItem('cacheflow_webdav_config')
  }

  /**
   * Refresh token (not applicable for WebDAV basic auth)
   */
  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    // Basic auth doesn't expire, just return the same token
    return token
  }

  /**
   * Check if we have valid configuration
   */
  isTokenValid(token: ProviderToken | null): boolean {
    return token !== null && !!token.accessToken
  }

  // ===========================================================================
  // Quota
  // ===========================================================================

  /**
   * Get storage quota (try to get from server)
   */
  async getQuota(): Promise<ProviderQuota> {
    // Try to get quota using WebDAV
    try {
      const response = await this.request('PROPFIND', '', {
        Depth: '0',
        headers: {
          'Content-Type': 'application/xml',
        },
      })

      if (response.ok) {
        const text = await response.text()
        // Parse quota from response if available
        // WebDAV doesn't have a standard way to report quota
      }
    } catch (e) {
      console.warn('[WebDAV] Could not get quota:', e)
    }

    // Return default values - quota not available via WebDAV
    return {
      used: 0,
      total: 0,
      free: 0,
      usedDisplay: 'Unknown',
      totalDisplay: 'Unknown',
      freeDisplay: 'Unknown',
      percentUsed: 0,
    }
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * List files in a folder
   */
  async listFiles(options?: { folderId?: string; pageSize?: number; pageToken?: string }): Promise<ListFilesResult> {
    const folderPath = options?.folderId || '/'

    const response = await this.request('PROPFIND', folderPath, {
      Depth: '1',
      headers: {
        'Content-Type': 'application/xml',
      },
    })

    if (!response.ok && response.status !== 207) {
      throw new Error(`Failed to list files: ${response.status}`)
    }

    const text = await response.text()
    const files = this.parseWebDAVResponse(text, folderPath)

    return {
      files,
      hasMore: false,
    }
  }

  /**
   * Get a specific file's metadata
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    const response = await this.request('PROPFIND', fileId, {
      Depth: '0',
    })

    if (!response.ok && response.status !== 207) {
      throw new Error(`Failed to get file: ${response.status}`)
    }

    const text = await response.text()
    const files = this.parseWebDAVResponse(text, fileId)

    if (files.length === 0) {
      throw new Error('File not found')
    }

    return files[0]
  }

  /**
   * Upload a file
   */
  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const folderId = options?.folderId || '/'
    const fileName = options?.fileName || file.name
    const targetPath = folderId === '/' ? `/${fileName}` : `${folderId}/${fileName}`

    const response = await this.request('PUT', targetPath, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    return this.getFile(targetPath)
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    const response = await this.request('GET', fileId)

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }

    return response.blob()
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const response = await this.request('DELETE', fileId)

    if (!response.ok && response.status !== 204) {
      throw new Error(`Delete failed: ${response.status}`)
    }
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    const parentPath = parentId || '/'
    const targetPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`

    const response = await this.request('MKCOL', targetPath)

    if (!response.ok && response.status !== 201) {
      throw new Error(`Create folder failed: ${response.status}`)
    }

    return this.getFile(targetPath)
  }

  /**
   * Move a file
   */
  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    // Extract filename from path
    const parts = fileId.split('/')
    const fileName = parts.pop()
    const newPath = newParentId === '/' ? `/${fileName}` : `${newParentId}/${fileName}`

    const response = await this.request('MOVE', fileId, {
      method: 'MOVE',
      headers: { Destination: this.getFullUrl(newPath) },
    })

    if (!response.ok && response.status !== 201) {
      throw new Error(`Move failed: ${response.status}`)
    }

    return this.getFile(newPath)
  }

  /**
   * Copy a file
   */
  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    // Extract filename from path
    const parts = fileId.split('/')
    const fileName = parts.pop()
    const newPath = newParentId === '/' ? `/${fileName}` : `${newParentId}/${fileName}`

    const response = await this.request('COPY', fileId, {
      method: 'COPY',
      headers: { Destination: this.getFullUrl(newPath) },
    })

    if (!response.ok && response.status !== 201) {
      throw new Error(`Copy failed: ${response.status}`)
    }

    return this.getFile(newPath)
  }

  /**
   * Rename a file (using MOVE)
   */
  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    // Extract parent path
    const parts = fileId.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'

    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`

    const response = await this.request('MOVE', fileId, {
      method: 'MOVE',
      headers: { Destination: this.getFullUrl(newPath) },
    })

    if (!response.ok && response.status !== 201) {
      throw new Error(`Rename failed: ${response.status}`)
    }

    return this.getFile(newPath)
  }

  // ===========================================================================
  // Sharing (Not typically supported by WebDAV)
  // ===========================================================================

  async getShareLink(fileId: string): Promise<string | null> {
    // WebDAV doesn't have a standard way to create share links
    return null
  }

  async revokeShareLink(fileId: string): Promise<void> {
    // Not supported
  }

  // ===========================================================================
  // Search (Not supported by WebDAV natively)
  // ===========================================================================

  async searchFiles(options: { query: string; pageSize?: number }): Promise<SearchResult> {
    // WebDAV doesn't support search natively
    // Could implement client-side filtering
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
  // Utility Methods
  // ===========================================================================

  getIcon(): string {
    return '🌐'
  }

  getColor(): string {
    return '#5C7CFA'
  }

  getFreeStorageGB(): number {
    return 0 // Varies by server
  }

  /**
   * Validate configuration
   */
  validateConfig(config: WebDAVConfig): { valid: boolean; error?: string } {
    if (!config.url) {
      return { valid: false, error: 'URL is required' }
    }

    if (!config.username || !config.password) {
      return { valid: false, error: 'Username and password are required' }
    }

    // Validate URL format
    try {
      new URL(config.url)
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }

    return { valid: true }
  }

  /**
   * Make WebDAV request
   */
  private async request(
    method: string,
    path: string,
    options: {
      method?: string
      body?: any
      headers?: Record<string, string>
      Depth?: string
      [key: string]: any
    } = {}
  ): Promise<Response> {
    this.ensureActiveToken()
    const config = this.getConfig()
    const url = this.getFullUrl(path)

    const headers: Record<string, string> = {
      ...options.headers,
    }

    // Add Depth header for PROPFIND
    if (options.Depth) {
      headers['Depth'] = options.Depth
    }

    // Add basic auth
    headers['Authorization'] = `Basic ${this.accessToken}`

    return fetch(url, {
      method: options.method || method,
      headers,
      body: options.body,
    })
  }

  /**
   * Get full URL for a path
   */
  private getFullUrl(path: string): string {
    const config = this.getConfig()
    const baseUrl = config.url.replace(/\/$/, '')
    const cleanPath = path.replace(/^\//, '')

    return `${baseUrl}/${cleanPath}`
  }

  /**
   * Parse WebDAV PROPFIND response
   */
  private parseWebDAVResponse(xml: string, basePath: string): FileMetadata[] {
    const files: FileMetadata[] = []

    // Simple regex-based parsing (not a full XML parser)
    const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g
    let match

    while ((match = responseRegex.exec(xml)) !== null) {
      const response = match[1]

      // Extract href
      const hrefMatch = response.match(/<d:href>(.*?)<\/d:href>/)
      if (!hrefMatch) continue

      let href = decodeURIComponent(hrefMatch[1])

      // Skip the base path itself (for Depth: 0)
      if (href === this.getFullUrl(basePath)) continue

      // Extract display name
      const displayNameMatch = response.match(/<d:displayname>(.*?)<\/d:displayname>/)
      const displayName = displayNameMatch ? displayNameMatch[1] : href.split('/').pop() || ''

      // Check if it's a collection (folder)
      const isCollection = response.includes('<d:collection>') ||
        response.includes('<d:collection/>') ||
        displayName.endsWith('/')

      // Extract content length
      const contentLengthMatch = response.match(/<d:getcontentlength>(.*?)<\/d:getcontentlength>/)
      const size = contentLengthMatch ? parseInt(contentLengthMatch[1]) || 0 : 0

      // Extract last modified
      const lastModifiedMatch = response.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/)
      const modifiedTime = lastModifiedMatch ? new Date(lastModifiedMatch[1]).toISOString() : new Date().toISOString()

      // Skip the root path
      if (href === this.getFullUrl('/')) continue

      // Clean up path
      const config = this.getConfig()
      const baseUrl = config.url.replace(/\/$/, '')
      const filePath = href.replace(baseUrl, '')

      files.push({
        id: filePath,
        name: displayName,
        path: filePath,
        pathDisplay: filePath,
        size,
        mimeType: isCollection ? 'application/vnd.folder' : formatMimeType(displayName),
        isFolder: isCollection,
        modifiedTime,
        provider: 'webdav',
        providerName: 'WebDAV',
      })
    }

    return files
  }
}

// Helper function for auth header
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('cf_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Export singleton with default config
export const webdavProvider = new WebDAVProvider()

