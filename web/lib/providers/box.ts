/**
 * Box Provider Adapter
 * Implements client-side OAuth for Box.com
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes } from './utils'

// Box OAuth configuration
const BOX_CLIENT_ID = process.env.NEXT_PUBLIC_BOX_CLIENT_ID || 'YOUR_BOX_CLIENT_ID'
const BOX_API_BASE = 'https://api.box.com/2.0'

export class BoxProvider extends StorageProvider {
  readonly id: ProviderId = 'box'
  readonly name: string = 'Box'

  private accessToken: string | null = null

  constructor() {
    super()
    this.loadToken()
  }

  private loadToken(): void {
    this.ensureActiveToken()
  }

  private ensureActiveToken(): void {
    const token = tokenManager.getToken('box')
    if (token) {
      this.accessToken = token.accessToken
    }
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Connect to Box using OAuth PKCE
   */
  async connect(): Promise<ProviderToken> {
    // Generate PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    sessionStorage.setItem('box_code_verifier', codeVerifier)

    // Build auth URL
    const authUrl = new URL('https://account.box.com/api/oauth2/authorize')
    authUrl.searchParams.set('client_id', BOX_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/auth/box/callback`)

    return new Promise((resolve, reject) => {
      const width = 600
      const height = 700
      const left = (window.innerWidth - width) / 2
      const top = (window.innerHeight - height) / 2

      const popup = window.open(
        authUrl.toString(),
        'Box Connect',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'box_auth_code') {
          window.removeEventListener('message', messageHandler)
          popup?.close()

          this.exchangeCodeForToken(event.data.code)
            .then(resolve)
            .catch(reject)
        }
      }

      window.addEventListener('message', messageHandler)

      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          reject(new Error('Authentication cancelled'))
        }
      }, 500)
    })
  }

  private async exchangeCodeForToken(code: string): Promise<ProviderToken> {
    const codeVerifier = sessionStorage.getItem('box_code_verifier')
    sessionStorage.removeItem('box_code_verifier')

    // PKCE flow - no client_secret needed
    const response = await this.proxyFetch('https://api.box.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: BOX_CLIENT_ID,
        code_verifier: codeVerifier || '',
      }),
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const data = await response.json()

    // Get user info
    const userInfo = await this.getUserInfo(data.access_token)

    const token: ProviderToken = {
      provider: 'box',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      accountEmail: userInfo.login,
      displayName: userInfo.name,
      accountId: userInfo.id,
    }

    tokenManager.saveToken('box', token)
    this.accessToken = token.accessToken

    tokenManager.onRefresh('box', (t) => this.refreshToken(t))
    tokenManager.startAutoRefresh('box', token)

    return token
  }

  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await this.proxyFetch(`${BOX_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) throw new Error('Failed to get user info')
    return response.json()
  }

  async disconnect(): Promise<void> {
    tokenManager.removeToken('box')
    this.accessToken = null
  }

  async refreshToken(token: ProviderToken): Promise<ProviderToken> {
    if (!token.refreshToken) throw new Error('No refresh token')

    // PKCE flow - no client_secret needed
    const response = await this.proxyFetch('https://api.box.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: BOX_CLIENT_ID,
      }),
    })

    if (!response.ok) throw new Error('Token refresh failed')

    const data = await response.json()

    const newToken: ProviderToken = {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
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
    const response = await this.makeRequest(`${BOX_API_BASE}/users/me`)

    const space = response.space_usage
    const total = space.allocated ?? space.space_amount ?? 0
    const used = space.used || 0

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
    const folderId = options?.folderId || '0' // 0 = root
    const limit = options?.pageSize || 100

    const response = await this.makeRequest(
      `${BOX_API_BASE}/folders/${folderId}/items?fields=name,size,created_at,modified_at,type,shared_link&limit=${limit}`
    )

    const files: FileMetadata[] = (response.entries || []).map((item: any) => this.mapFile(item))

    return {
      files,
      hasMore: response.entries?.length >= limit,
    }
  }

  async getFile(fileId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(
      `${BOX_API_BASE}/files/${fileId}?fields=name,size,created_at,modified_at,type,shared_link`
    )

    return this.mapFile(response)
  }

  async uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata> {
    this.ensureActiveToken()
    const folderId = options?.folderId || '0'
    const fileName = options?.fileName || file.name

    const formData = new FormData()
    formData.append('attributes', JSON.stringify({
      name: fileName,
      parent: { id: folderId },
    }))
    formData.append('file', file)

    const response = await this.proxyFetch('https://upload.box.com/api/2.0/files/content', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: formData,
    })

    if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`)

    const data = await response.json()
    return this.mapFile(data.entries[0])
  }

  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob> {
    this.ensureActiveToken()
    const response = await this.proxyFetch(`${BOX_API_BASE}/files/${fileId}/content`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })

    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)
    return response.blob()
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.makeRequest(`${BOX_API_BASE}/files/${fileId}`, { method: 'DELETE' })
  }

  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    const parent = parentId || '0'

    const response = await this.makeRequest(`${BOX_API_BASE}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name, parent: { id: parent } }),
    })

    return this.mapFile(response)
  }

  async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const file = await this.getFile(fileId)

    const response = await this.makeRequest(`${BOX_API_BASE}/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify({ parent: { id: newParentId } }),
    })

    return this.mapFile(response)
  }

  async copyFile(fileId: string, newParentId: string): Promise<FileMetadata> {
    const response = await this.makeRequest(`${BOX_API_BASE}/files/${fileId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ parent: { id: newParentId } }),
    })

    return this.mapFile(response)
  }

  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    const response = await this.makeRequest(`${BOX_API_BASE}/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName }),
    })

    return this.mapFile(response)
  }

  // ===========================================================================
  // Sharing
  // ===========================================================================

  async getShareLink(fileId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest(`${BOX_API_BASE}/files/${fileId}`, {
        method: 'PUT',
        body: JSON.stringify({
          shared_link: { access: 'open' },
        }),
      })

      return response.shared_link?.url || null
    } catch {
      return null
    }
  }

  async revokeShareLink(fileId: string): Promise<void> {
    await this.makeRequest(`${BOX_API_BASE}/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify({ shared_link: null }),
    })
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async searchFiles(options: { query: string; pageSize?: number }): Promise<SearchResult> {
    const limit = options.pageSize || 100

    const response = await this.makeRequest(
      `${BOX_API_BASE}/search?query=${encodeURIComponent(options.query)}&limit=${limit}`
    )

    const files: FileMetadata[] = (response.entries || [])
      .filter((item: any) => item.type === 'file')
      .map((item: any) => this.mapFile(item))

    return {
      files,
      hasMore: response.entries?.length >= limit,
    }
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  getIcon(): string {
    return '📁'
  }

  getColor(): string {
    return '#0061D5'
  }

  getFreeStorageGB(): number {
    return 10
  }

  private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
    this.ensureActiveToken()
    if (!this.accessToken && !this.remoteId) {
      throw new Error('Not authenticated')
    }

    const response = await this.proxyFetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401 && !retried) {
        const refreshed = await tokenManager.refreshToken('box')
        if (refreshed) {
          this.accessToken = refreshed.accessToken
          return this.makeRequest(url, options, true)
        }
        throw new Error('SESSION_EXPIRED')
      }
      throw new Error(`Box API error: ${response.statusText}`)
    }

    return response.json()
  }

  private mapFile(item: any): FileMetadata {
    const isFolder = item.type === 'folder'

    return {
      id: item.id,
      name: item.name,
      path: item.path_collection?.entries?.map((e: any) => e.name).join('/') || item.name,
      pathDisplay: item.path_display || item.name,
      size: item.size || 0,
      mimeType: isFolder ? 'application/vnd.folder' : (item.name?.split('.').pop() ? `application/${item.name.split('.').pop()}` : 'application/octet-stream'),
      isFolder,
      createdTime: item.created_at,
      modifiedTime: item.modified_at,
      provider: 'box',
      providerName: 'Box',
      shareLink: item.shared_link?.url,
    }
  }
}

export const boxProvider = new BoxProvider()

