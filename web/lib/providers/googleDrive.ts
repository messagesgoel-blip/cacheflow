/**
 * Google Drive Provider Adapter
 * Implements client-side OAuth for Google Drive
 */

import { StorageProvider, ProviderOptions, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '416179978413-909akdt6cjbh98q6be5mg5dg5i2o1tff.apps.googleusercontent.com'
const GOOGLE_SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ')

const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
]

export class GoogleDriveProvider extends StorageProvider {
  readonly id: ProviderId = 'google'
  readonly name: string = 'Google Drive'

  private accessToken: string | null = null
  private tokenClient: any = null
  private initialized: boolean = false

  constructor() {
    super()
    this.loadToken()
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Load token from token manager
   */
  private loadToken(): void {
    const token = tokenManager.getToken('google')
    if (token) {
      this.accessToken = token.accessToken
    }
  }

  /**
   * Initialize Google Identity Services
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    // Load GIS script if not already loaded
    if (!window.google?.accounts?.oauth2) {
      await this.loadGisScript()
    }

    this.initialized = true
  }

  /**
   * Load Google Identity Services script
   */
  private loadGisScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
      document.head.appendChild(script)
    })
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Connect to Google Drive using OAuth popup
   */
  async connect(): Promise<ProviderToken> {
    await this.initialize()

    return new Promise((resolve, reject) => {
      // Create token client
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error))
            return
          }

          // Get user info
          this.getUserInfo(response.access_token).catch(err => {
        console.warn("[GoogleDrive] getUserInfo failed, using fallback:", err);
        return { email: "user@gmail.com", name: "Google User", id: "unknown" };
      })
            .then(userInfo => {
              const token: ProviderToken = {
                provider: 'google',
                accessToken: response.access_token,
                refreshToken: response.refresh_token,
                expiresAt: Date.now() + (response.expires_in * 1000),
                accountEmail: userInfo.email,
                displayName: userInfo.name,
                accountId: userInfo.id,
              }

              // Save token
              tokenManager.saveToken('google', token)
              this.accessToken = token.accessToken

              // Register refresh callback
              tokenManager.onRefresh('google', (t) => this.refreshToken(t))

              // Start auto-refresh
              tokenManager.startAutoRefresh('google', token)

              resolve(token)
            })
            .catch(reject)
        },
      })

      // Request access token
      client.requestAccessToken({ prompt: 'consent' })
    })
  }

  /**
   * Get user info from Google API
   */
  private async getUserInfo(accessToken: string): Promise<{ id: string; email: string; name: string }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      console.error('[GoogleDrive] getUserInfo error:', response.status, await response.text())
      throw new Error('Failed to get user info: ' + response.status)
    }

    return response.json()
  }

  /**
   * Disconnect from Google Drive
   */
  async disconnect(): Promise<void> {
    // Revoke the access token
    if (this.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: 'POST',
        })
      } catch (e) {
        console.warn('[GoogleDrive] Failed to revoke token:', e)
      }
    }

    // Remove token from storage
    tokenManager.removeToken('google')
    this.accessToken = null
  }

  /**
   * Refresh the access token
   */
  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    // For Google, we need to use the token client to get a new access token
    // This is handled by Google Identity Services automatically
    // If we have a refresh token, we can use it

    await this.initialize()

    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error))
            return
          }

          const newToken: ProviderToken = {
            ...token,
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in * 1000),
          }

          this.accessToken = newToken.accessToken
          resolve(newToken)
        },
      })

      // Use prompt=none to avoid showing consent dialog
      client.requestAccessToken({ prompt: '' })
    })
  }

  /**
   * Check if token is valid
   */
  isTokenValid(token: ProviderToken): boolean {
    return tokenManager.isTokenValid(token)
  }

  // ===========================================================================
  // Quota
  // ===========================================================================

  /**
   * Get storage quota
   */
  async getQuota(): Promise<ProviderQuota> {
    const response = await this.makeRequest('https://www.googleapis.com/drive/v3/about?fields=storageQuota')

    const quota = response.storageQuota

    const used = parseInt(quota.usage) || 0
    const total = parseInt(quota.limit) || 0
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
   * List files in a folder
   */
  async listFiles(options?: { folderId?: string; pageSize?: number; pageToken?: string }): Promise<ListFilesResult> {
    const folderId = options?.folderId || 'root'
    const pageSize = options?.pageSize || 100

    let query = `'${folderId}' in parents and trashed = false`

    const params = new URLSearchParams({
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, iconLink)',
      pageSize: String(pageSize),
      orderBy: 'modifiedTime desc',
    })

    if (options?.pageToken) {
      params.set('pageToken', options.pageToken)
    }

    const response = await this.makeRequest(
      `https://www.googleapis.com/drive/v3/files?${params}&q=${encodeURIComponent(query)}`
    )

    const files: FileMetadata[] = (response.files || []).map((file: any) => this.mapFile(file))

    return {
      files,
      nextPageToken: response.nextPageToken,
      hasMore: !!response.nextPageToken,
    }
  }

  /**
   * Get a specific file
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,iconLink`
    )

    return this.mapFile(response)
  }

  /**
   * Upload a file
   */
  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const folderId = options?.folderId || 'root'
    const fileName = options?.fileName || file.name

    // For simplicity, use multipart upload
    const metadata = {
      name: fileName,
      parents: [folderId],
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: form,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Upload failed: ${error}`)
    }

    const uploadedFile = await response.json()
    return this.getFile(uploadedFile.id)
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,mimeType`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    )

    const metadata = await response.json()

    // Google Docs types that need export (explicit allowlist)
    const googleDocsTypes = [
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.google-apps.presentation',
      'application/vnd.google-apps.drawing',
      'application/vnd.google-apps.form',
      'application/vnd.google-apps.audio',
    ]

    // Check if it's a Google Doc that needs export
    if (googleDocsTypes.includes(metadata.mimeType)) {
      // Export as PDF
      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      )

      return exportResponse.blob()
    }

    // Download directly
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    )

    return downloadResponse.blob()
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : ['root'],
    }

    const response = await this.makeRequest('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify(metadata),
    })

    return this.getFile(response.id)
  }

  /**
   * Move a file
   */
  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    // Fetch current parents directly from API
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    )
    const fileData = await fileResponse.json()
    const previousParents = fileData.parents || []

    // Update with new parent
    await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        addParents: newParentId,
        removeParents: previousParents.join(','),
      }),
    })

    return this.getFile(fileId)
  }

  /**
   * Copy a file
   */
  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const metadata = {
      parents: [newParentId],
    }

    const response = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
      method: 'POST',
      body: JSON.stringify(metadata),
    })

    return this.getFile(response.id)
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    })

    return this.getFile(fileId)
  }

  // ===========================================================================
  // Sharing
  // ===========================================================================

  /**
   * Get share link
   */
  async getShareLink(fileId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`
      )
      return response.webViewLink || null
    } catch {
      return null
    }
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(fileId: string): Promise<void> {
    // Google Drive doesn't have a direct way to revoke web links
    // Could update permissions but that's complex
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search files
   */
  async searchFiles(options: { query: string; pageSize?: number; pageToken?: string }): Promise<SearchResult> {
    const pageSize = options.pageSize || 100
    const query = `name contains '${options.query}' and trashed = false`

    const params = new URLSearchParams({
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, iconLink)',
      pageSize: String(pageSize),
      orderBy: 'modifiedTime desc',
    })

    if (options.pageToken) {
      params.set('pageToken', options.pageToken)
    }

    const response = await this.makeRequest(
      `https://www.googleapis.com/drive/v3/files?${params}&q=${encodeURIComponent(query)}`
    )

    const files: FileMetadata[] = (response.files || []).map((file: any) => this.mapFile(file))

    return {
      files,
      nextPageToken: response.nextPageToken,
      hasMore: !!response.nextPageToken,
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  getIcon(): string {
    return '📁'
  }

  getColor(): string {
    return '#4285F4'
  }

  getFreeStorageGB(): number {
    return 15
  }

  /**
   * Make authenticated request
   */
  private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
    if (!this.accessToken) {
      const token = tokenManager.getToken('google')
      if (!token) {
        throw new Error('Not authenticated')
      }
      this.accessToken = token.accessToken
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Handle 401 - try to refresh token once only
      if (response.status === 401 && !retried) {
        const refreshed = await tokenManager.refreshToken('google')
        if (refreshed) {
          this.accessToken = refreshed.accessToken
          // Retry request with retried=true to prevent infinite recursion
          return this.makeRequest(url, options, true)
        }
      }

      const error = await response.text().catch(() => 'Unknown error')
      throw new Error(`Google Drive API error: ${error}`)
    }

    // Handle empty responses
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  }

  /**
   * Map Google Drive file to our FileMetadata format
   */
  private mapFile(file: any): FileMetadata {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder'

    return {
      id: file.id,
      name: file.name,
      path: file.id, // Google Drive uses IDs, not paths
      pathDisplay: file.name,
      size: parseInt(file.size) || 0,
      mimeType: file.mimeType,
      isFolder,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      provider: 'google',
      providerName: 'Google Drive',
      webUrl: file.webViewLink,
      thumbnailUrl: file.iconLink,
    }
  }
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Export singleton
export const googleDriveProvider = new GoogleDriveProvider()

// Declare google global type
declare global {
  interface Window {
    google: any
  }
}
