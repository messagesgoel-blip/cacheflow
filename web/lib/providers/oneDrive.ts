/**
 * OneDrive Provider Adapter
 * Implements client-side OAuth for Microsoft OneDrive
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { formatBytes, formatMimeType } from './utils'

// Microsoft OAuth configuration
const MSAL_CLIENT_ID = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID || 'YOUR_MSAL_CLIENT_ID'
const MSAL_TENANT_ID = 'common' // Use 'common' for multi-tenant

// OneDrive API base
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

export class OneDriveProvider extends StorageProvider {
  readonly id: ProviderId = 'onedrive'
  readonly name: string = 'OneDrive'

  private accessToken: string | null = null
  private msalInstance: any = null

  constructor() {
    super()
    this.loadToken()
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private loadToken(): void {
    const token = tokenManager.getToken('onedrive')
    if (token) {
      this.accessToken = token.accessToken
    }
  }

  /**
   * Initialize MSAL (Microsoft Authentication Library)
   */
  private async initialize(): Promise<void> {
    if (this.msalInstance) return

    // Load MSAL script if not already loaded
    if (!window.MSAL) {
      await this.loadMsalScript()
    }

    this.msalInstance = new window.MSAL.PublicClientApplication({
      auth: {
        clientId: MSAL_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${MSAL_TENANT_ID}`,
        redirectUri: window.location.origin,
      },
    })
  }

  private loadMsalScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.MSAL) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://alcdn.msauth.net/browser/3.1.0/js/msal-browser.min.js'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load MSAL'))
      document.head.appendChild(script)
    })
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Connect to OneDrive using MSAL popup
   */
  async connect(): Promise<ProviderToken> {
    await this.initialize()

    const loginRequest = {
      scopes: ['Files.ReadWrite.All', 'offline_access', 'User.Read'],
    }

    try {
      const response = await this.msalInstance.loginPopup(loginRequest)

      // Get user info
      const account = response.account
      const userInfo = await this.getUserInfo(response.accessToken)

      const token: ProviderToken = {
        provider: 'onedrive',
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: Date.now() + (response.expiresIn * 1000),
        accountEmail: account.username || userInfo.mail || userInfo.userPrincipalName,
        displayName: account.name || userInfo.displayName,
        accountId: account.localAccountId,
      }

      // Save token
      tokenManager.saveToken('onedrive', token)
      this.accessToken = token.accessToken

      // Register refresh callback
      tokenManager.onRefresh('onedrive', (t) => this.refreshToken(t))

      // Start auto-refresh
      tokenManager.startAutoRefresh('onedrive', token)

      return token
    } catch (error: any) {
      throw new Error(`OneDrive login failed: ${error.message}`)
    }
  }

  /**
   * Get user info from Microsoft Graph
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch(`${GRAPH_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error('Failed to get user info')
    }

    return response.json()
  }

  /**
   * Disconnect from OneDrive
   */
  async disconnect(): Promise<void> {
    try {
      await this.msalInstance.logoutPopup()
    } catch (e) {
      console.warn('[OneDrive] Logout warning:', e)
    }

    tokenManager.removeToken('onedrive')
    this.accessToken = null
  }

  /**
   * Refresh token
   */
  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    await this.initialize()

    try {
      const response = await this.msalInstance.acquireTokenByRefreshToken({
        scopes: ['Files.ReadWrite.All', 'offline_access'],
        refreshToken: token.refreshToken,
      })

      const newToken: ProviderToken = {
        ...token,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || token.refreshToken,
        expiresAt: Date.now() + (response.expiresIn * 1000),
      }

      this.accessToken = newToken.accessToken
      return newToken
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.message}`)
    }
  }

  /**
   * Check if token is valid
   */
  isTokenValid(token: ProviderToken | null): boolean {
    return tokenManager.isTokenValid(token)
  }

  // ===========================================================================
  // Quota
  // ===========================================================================

  /**
   * Get storage quota
   */
  async getQuota(): Promise<ProviderQuota> {
    const response = await this.makeRequest(`${GRAPH_API_BASE}/me/drive`)

    const quota = response.quota

    const used = parseInt(quota.used) || 0
    const total = parseInt(quota.total) || 0
    const free = parseInt(quota.remaining) || total - used

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

    let endpoint = `${GRAPH_API_BASE}/me/drive/${folderId === 'root' ? 'root' : folderId}/children`
    const params = new URLSearchParams({
      $top: String(pageSize),
      $select: 'id,name,size,fileSystemInfo,folder,file,webUrl,@microsoft.graph.downloadUrl',
      $orderby: 'fileSystemInfo/lastModifiedDateTime desc',
    })

    if (options?.pageToken) {
      params.set('$skiptoken', options.pageToken)
    }

    const response = await this.makeRequest(`${endpoint}?${params}`)

    const files: FileMetadata[] = (response.value || []).map((item: any) => this.mapFile(item))

    return {
      files,
      nextPageToken: response['@odata.nextLink']?.split('$skiptoken=')[1],
      hasMore: !!response['@odata.nextLink'],
    }
  }

  /**
   * Get a specific file
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/${fileId}?$select=id,name,size,fileSystemInfo,folder,file,webUrl,@microsoft.graph.downloadUrl`
    )

    return this.mapFile(response)
  }

  /**
   * Upload a file
   */
  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const folderId = options?.folderId || 'root'
    const fileName = options?.fileName || file.name

    // Determine upload URL
    const path = folderId === 'root' ? `/${fileName}` : `/${folderId}/${fileName}`

    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/root:/${encodeURIComponent(fileName)}:/content`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      }
    )

    return this.mapFile(response)
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    // First get the download URL
    const file = await this.getFile(fileId)

    // The download URL should be in the file metadata
    const downloadUrl = (file as any)['@microsoft.graph.downloadUrl']
    if (!downloadUrl) {
      throw new Error('Download URL not available')
    }

    const response = await fetch(downloadUrl)

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }

    return response.blob()
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.makeRequest(`${GRAPH_API_BASE}/me/drive/${fileId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    const parentPath = parentId || 'root'

    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/${parentPath}/children`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }),
      }
    )

    return this.mapFile(response)
  }

  /**
   * Move a file
   */
  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/${fileId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          parentReference: {
            id: newParentId,
          },
        }),
      }
    )

    return this.mapFile(response)
  }

  /**
   * Copy a file
   */
  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/${fileId}/copy`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentReference: {
            id: newParentId,
          },
        }),
      }
    )

    // Copy returns 202 Accepted, we need to poll for completion
    // For now, return the item (which may be incomplete)
    return this.getFile(fileId)
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/${fileId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      }
    )

    return this.mapFile(response)
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
        `${GRAPH_API_BASE}/me/drive/${fileId}/createLink`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'view',
            scope: 'anonymous',
          }),
        }
      )

      return response.link?.webUrl || null
    } catch {
      return null
    }
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(fileId: string): Promise<void> {
    // Microsoft Graph doesn't provide a direct way to revoke links
    // Could delete permissions but that's complex
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search files
   */
  async searchFiles(options: { query: string; pageSize?: number; pageToken?: string }): Promise<SearchResult> {
    const pageSize = options.pageSize || 100

    const response = await this.makeRequest(
      `${GRAPH_API_BASE}/me/drive/root/search(q='${encodeURIComponent(options.query)}')?$top=${pageSize}`
    )

    const files: FileMetadata[] = (response.value || []).map((item: any) => this.mapFile(item))

    return {
      files,
      hasMore: !!response['@odata.nextLink'],
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  getIcon(): string {
    return '☁️'
  }

  getColor(): string {
    return '#0078D4'
  }

  getFreeStorageGB(): number {
    return 5
  }

  /**
   * Make authenticated request to Microsoft Graph
   */
  private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
    if (!this.accessToken) {
      const token = tokenManager.getToken('onedrive')
      if (!token) {
        throw new Error('Not authenticated')
      }
      this.accessToken = token.accessToken
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Handle 401 - try to refresh token
      if (response.status === 401 && !retried) {
        const refreshed = await tokenManager.refreshToken('onedrive')
        if (refreshed) {
          this.accessToken = refreshed.accessToken
          // Retry request
          return this.makeRequest(url, options, true)
        }
        throw new Error('SESSION_EXPIRED')
      }

      const error = await response.text().catch(() => 'Unknown error')
      throw new Error(`OneDrive API error: ${error}`)
    }

    // Handle empty responses
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  }

  /**
   * Map OneDrive item to our FileMetadata format
   */
  private mapFile(item: any): FileMetadata {
    const isFolder = !!item.folder

    return {
      id: item.id,
      name: item.name,
      path: item.parentReference?.path ? `${item.parentReference.path}/${item.name}` : `/${item.name}`,
      pathDisplay: item.name,
      size: parseInt(item.size) || 0,
      mimeType: item.file?.mimeType || (isFolder ? 'application/vnd.folder' : 'application/octet-stream'),
      isFolder,
      createdTime: item.fileSystemInfo?.createdDateTime,
      modifiedTime: item.fileSystemInfo?.lastModifiedDateTime,
      provider: 'onedrive',
      providerName: 'OneDrive',
      webUrl: item.webUrl,
      thumbnailUrl: item.thumbnailUrl,
    }
  }
}

// Export singleton
export const oneDriveProvider = new OneDriveProvider()

// Declare global types
declare global {
  interface Window {
    MSAL: any
  }
}
