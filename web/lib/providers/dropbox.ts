/**
 * Dropbox Provider Adapter
 * Implements client-side OAuth for Dropbox
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

// Dropbox OAuth configuration
const DROPBOX_APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || 'YOUR_DROPBOX_APP_KEY'
const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2'
const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2'

export class DropboxProvider extends StorageProvider {
  readonly id: ProviderId = 'dropbox'
  readonly name: string = 'Dropbox'

  private accessToken: string | null = null

  constructor() {
    super()
    this.loadToken()
  }

  private loadToken(): void {
    const token = tokenManager.getToken('dropbox')
    if (token) {
      this.accessToken = token.accessToken
    }
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Connect to Dropbox using PKCE OAuth
   */
  async connect(): Promise<ProviderToken> {
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    // Store code verifier for later
    sessionStorage.setItem('dropbox_code_verifier', codeVerifier)

    // Build authorization URL
    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize')
    authUrl.searchParams.set('client_id', DROPBOX_APP_KEY)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/auth/dropbox/callback`)
    authUrl.searchParams.set('token_access_type', 'offline')

    // Open popup
    return new Promise((resolve, reject) => {
      const width = 600
      const height = 700
      const left = (window.innerWidth - width) / 2
      const top = (window.innerHeight - height) / 2

      const popup = window.open(
        authUrl.toString(),
        'Dropbox Connect',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Listen for message from popup
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'dropbox_auth_code') {
          window.removeEventListener('message', messageHandler)
          popup?.close()

          // Exchange code for token
          this.exchangeCodeForToken(event.data.code)
            .then(resolve)
            .catch(reject)
        }
      }

      window.addEventListener('message', messageHandler)

      // Check if popup was closed without auth
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          reject(new Error('Authentication cancelled'))
        }
      }, 500)
    })
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<ProviderToken> {
    const codeVerifier = sessionStorage.getItem('dropbox_code_verifier')
    sessionStorage.removeItem('dropbox_code_verifier')

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: DROPBOX_APP_KEY,
        redirect_uri: `${window.location.origin}/api/auth/dropbox/callback`,
        code_verifier: codeVerifier || '',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const data = await response.json()

    // Get user info
    const userInfo = await this.getUserInfo(data.access_token)

    const token: ProviderToken = {
      provider: 'dropbox',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      accountEmail: userInfo.email,
      displayName: userInfo.name,
      accountId: data.account_id,
    }

    tokenManager.saveToken('dropbox', token)
    this.accessToken = token.accessToken

    tokenManager.onRefresh('dropbox', (t) => this.refreshToken(t))
    tokenManager.startAutoRefresh('dropbox', token)

    return token
  }

  /**
   * Get user info
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch(`${DROPBOX_API_BASE}/users/get_current_account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get user info')
    }

    const data = await response.json()
    return {
      email: data.email,
      name: data.name.display_name,
      accountId: data.account_id,
    }
  }

  /**
   * Disconnect from Dropbox
   */
  async disconnect(): Promise<void> {
    // Optionally revoke token
    if (this.accessToken) {
      try {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
        })
      } catch (e) {
        console.warn('[Dropbox] Token revoke failed:', e)
      }
    }

    tokenManager.removeToken('dropbox')
    this.accessToken = null
  }

  /**
   * Refresh token
   */
  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    if (!token.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: DROPBOX_APP_KEY,
      }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()

    const newToken: ProviderToken = {
      ...token,
      accessToken: data.access_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    }

    this.accessToken = newToken.accessToken
    return newToken
  }

  isTokenValid(token: ProviderToken | null): boolean {
    return tokenManager.isTokenValid(token)
  }

  // ===========================================================================
  // Quota
  // ===========================================================================

  async getQuota(): Promise<ProviderQuota> {
    const response = await this.makeRequest(`${DROPBOX_API_BASE}/users/get_space_usage`)

    const allocation = response.allocation
    const used = response.used
    const total = allocation.allocated

    return {
      used,
      total,
      free: total - used,
      usedDisplay: formatBytes(used),
      totalDisplay: formatBytes(total),
      freeDisplay: formatBytes(total - used),
      percentUsed: total > 0 ? (used / total) * 100 : 0,
    }
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  async listFiles(options?: { folderId?: string; pageSize?: number }): Promise<ListFilesResult> {
    const path = options?.folderId || ''

    const response = await this.makeRequest(
      `${DROPBOX_API_BASE}/files/list_folder`,
      { path: path || '' }
    )

    const files: FileMetadata[] = (response.entries || []).map((item: any) => this.mapFile(item))

    return {
      files,
      hasMore: response.has_more,
    }
  }

  async getFile(fileId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `${DROPBOX_API_BASE}/files/get_metadata`,
      { path: fileId }
    )

    return this.mapFile(response)
  }

  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    const folderPath = options?.folderId || ''
    const fileName = options?.fileName || file.name
    const path = folderPath ? `${folderPath}/${fileName}` : `/${fileName}`

    // For small files, use simple upload
    const response = await this.makeContentRequest(
      `${DROPBOX_CONTENT_BASE}/files/upload`,
      {
        path,
        mode: 'add',
        autorename: true,
      },
      file
    )

    const data = await response.json()
    return this.mapFile(data)
  }

  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    const response = await this.makeContentRequest(
      `${DROPBOX_CONTENT_BASE}/files/download`,
      { path: fileId }
    )

    return response.blob()
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.makeRequest(`${DROPBOX_API_BASE}/files/delete_v2`, { path: fileId })
  }

  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    const path = parentId ? `${parentId}/${name}` : `/${name}`

    const response = await this.makeRequest(`${DROPBOX_API_BASE}/files/create_folder_v2`, {
      path,
      autorename: false,
    })

    return this.mapFile(response.metadata)
  }

  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const fileName = fileId.split('/').pop()
    const toPath = newParentId ? `${newParentId}/${fileName}` : `/${fileName}`

    const response = await this.makeRequest(`${DROPBOX_API_BASE}/files/move_v2`, {
      from_path: fileId,
      to_path: toPath,
    })

    return this.mapFile(response.metadata)
  }

  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const fileName = fileId.split('/').pop()
    const toPath = newParentId ? `${newParentId}/${fileName}` : `/${fileName}`

    const response = await this.makeRequest(`${DROPBOX_API_BASE}/files/copy_v2`, {
      from_path: fileId,
      to_path: toPath,
    })

    return this.mapFile(response.metadata)
  }

  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    const parentPath = fileId.split('/').slice(0, -1).join('/')
    const toPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`

    const response = await this.makeRequest(`${DROPBOX_API_BASE}/files/move_v2`, {
      from_path: fileId,
      to_path: toPath,
    })

    return this.mapFile(response.metadata)
  }

  // ===========================================================================
  // Sharing
  // ===========================================================================

  async getShareLink(fileId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest(`${DROPBOX_API_BASE}/sharing/create_shared_link_with_settings`, {
        path: fileId,
      })

      return response.url
    } catch {
      // Link might already exist
      try {
        const listResponse = await this.makeRequest(`${DROPBOX_API_BASE}/sharing/list_shared_links`, {
          path: fileId,
        })

        if (listResponse.links?.length > 0) {
          return listResponse.links[0].url
        }
      } catch {}

      return null
    }
  }

  async revokeShareLink(fileId: string): Promise<void> {
    // Get the link first
    const listResponse = await this.makeRequest(`${DROPBOX_API_BASE}/sharing/list_shared_links`, {
      path: fileId,
    })

    if (listResponse.links?.length > 0) {
      await this.makeRequest(`${DROPBOX_API_BASE}/sharing/remove_shared_link`, {
        url: listResponse.links[0].url,
      })
    }
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async searchFiles(options: { query: string; pageSize?: number }): Promise<SearchResult> {
    const response = await this.makeRequest(`${DROPBOX_API_BASE}/files/search_v2`, {
      query: options.query,
      options: {
        path: '',
        max_results: options.pageSize || 100,
      },
    })

    const files: FileMetadata[] = (response.matches || []).map((match: any) =>
      this.mapFile(match.metadata.metadata)
    )

    return {
      files,
      hasMore: response.has_more,
    }
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  getIcon(): string {
    return '📦'
  }

  getColor(): string {
    return '#0061FF'
  }

  getFreeStorageGB(): number {
    return 2
  }

  // ===========================================================================
  // API Helpers
  // ===========================================================================

  private async makeRequest(endpoint: string, body?: any, retried = false): Promise<any> {
    if (!this.accessToken) {
      const token = tokenManager.getToken('dropbox')
      if (!token) throw new Error('Not authenticated')
      this.accessToken = token.accessToken
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      if (response.status === 401 && !retried) {
        const refreshed = await tokenManager.refreshToken('dropbox')
        if (refreshed) {
          this.accessToken = refreshed.accessToken
          return this.makeRequest(endpoint, body, true)
        }
        throw new Error('SESSION_EXPIRED')
      }
      throw new Error(`Dropbox API error: ${response.statusText}`)
    }

    return response.json()
  }

  private async makeContentRequest(endpoint: string, metadata?: any, body?: Blob | File): Promise<Response> {
    if (!this.accessToken) {
      const token = tokenManager.getToken('dropbox')
      if (!token) throw new Error('Not authenticated')
      this.accessToken = token.accessToken
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    }

    if (metadata) {
      headers['Dropbox-API-Arg'] = JSON.stringify(metadata)
    }

    if (body) {
      headers['Content-Type'] = 'application/octet-stream'
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    })

    if (!response.ok) {
      throw new Error(`Dropbox content API error: ${response.statusText}`)
    }

    return response
  }

  private mapFile(item: any): FileMetadata {
    const isFolder = item['.tag'] === 'folder'

    return {
      id: item.path_lower || item.path_display || item.id,
      name: item.name,
      path: item.path_display || item.path_lower || '',
      pathDisplay: item.path_display || '',
      size: item.size || 0,
      mimeType: isFolder ? 'application/vnd.folder' : formatMimeType(item.name),
      isFolder,
      createdTime: item.client_modified,
      modifiedTime: item.server_modified,
      provider: 'dropbox',
      providerName: 'Dropbox',
    }
  }
}

export const dropboxProvider = new DropboxProvider()
