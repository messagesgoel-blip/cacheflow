/**
 * Yandex Disk Provider Adapter
 * Implements client-side OAuth for Yandex Disk
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

const YANDEX_CLIENT_ID = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID || 'YOUR_YANDEX_CLIENT_ID') : ''
const YANDEX_API_BASE = 'https://cloud-api.yandex.net/v1'

export class YandexProvider extends StorageProvider {
  readonly id: ProviderId = 'yandex'
  readonly name: string = 'Yandex Disk'

  private accessToken: string | null = null

  constructor() {
    super()
    if (typeof window !== 'undefined') {
      this.loadToken()
    }
  }

  private loadToken(): void {
    this.ensureActiveToken()
  }

  private ensureActiveToken(): void {
    const token = tokenManager.getToken('yandex')
    if (token) this.accessToken = token.accessToken
  }

  async connect(): Promise<ProviderToken> {
    if (typeof window === 'undefined') throw new Error('Cannot connect on server')

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    sessionStorage.setItem('yandex_code_verifier', codeVerifier)

    const authUrl = new URL('https://oauth.yandex.com/authorize')
    authUrl.searchParams.set('client_id', YANDEX_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('redirect_uri', window.location.origin + '/api/auth/yandex/callback')
    authUrl.searchParams.set('scope', 'cloud_api:disk.read cloud_api:disk.write')

    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'Yandex Connect', 'width=600,height=700')
      if (!popup) { reject(new Error('Popup blocked')); return }

      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'yandex_auth_code') {
          window.removeEventListener('message', handler)
          popup.close()
          this.exchangeCode(e.data.code).then(resolve).catch(reject)
        }
      }
      window.addEventListener('message', handler)

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handler)
          reject(new Error('Authentication cancelled'))
        }
      }, 500)
    })
  }

  private async exchangeCode(code: string): Promise<ProviderToken> {
    const cv = sessionStorage.getItem('yandex_code_verifier')
    sessionStorage.removeItem('yandex_code_verifier')
    
    const res = await this.proxyFetch('https://oauth.yandex.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code', client_id: YANDEX_CLIENT_ID,
        redirect_uri: window.location.origin + '/api/auth/yandex/callback', code_verifier: cv || ''
      })
    })
    if (!res.ok) throw new Error('Token exchange failed')
    const data = await res.json()
    
    const userInfo = await this.getUserInfo(data.access_token)
    
    const token: ProviderToken = {
      provider: 'yandex', accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      accountEmail: userInfo.email, displayName: userInfo.displayName || userInfo.email.split('@')[0]
    }
    tokenManager.saveToken('yandex', token)
    this.accessToken = token.accessToken
    tokenManager.onRefresh('yandex', t => this.refreshToken(t))
    return token
  }

  private async getUserInfo(at: string): Promise<{ email: string; displayName?: string }> {
    const res = await this.proxyFetch(YANDEX_API_BASE+'/disk', { headers: { Authorization: 'Bearer '+at } })
    if (!res.ok) throw new Error('Failed to get user info')
    const d = await res.json()
    return { email: d.user.email, displayName: d.user.displayName }
  }

  async disconnect(): Promise<void> { tokenManager.removeToken('yandex'); this.accessToken = null }

  async refreshToken(t: ProviderToken): Promise<ProviderToken> {
    if (!t.refreshToken) throw new Error('No refresh token')
    const res = await this.proxyFetch('https://oauth.yandex.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: YANDEX_CLIENT_ID })
    })
    if (!res.ok) throw new Error('Refresh failed')
    const data = await res.json()
    const nt = { ...t, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null }
    this.accessToken = nt.accessToken
    tokenManager.saveToken('yandex', nt)
    return nt
  }

  isTokenValid(t: ProviderToken | null): boolean { return tokenManager.isTokenValid(t) }

  async getQuota(): Promise<ProviderQuota> {
    const r = await this.req('/disk')
    const u = r.used_space, tot = r.total_space, f = r.total_space - r.used_space
    return { used: u, total: tot, free: f, usedDisplay: formatBytes(u), totalDisplay: formatBytes(tot), freeDisplay: formatBytes(f), percentUsed: tot > 0 ? (u/tot)*100 : 0 }
  }

  async listFiles(o?: { folderId?: string }): Promise<ListFilesResult> {
    const r = await this.req('/disk/resources?path='+encodeURIComponent(o?.folderId||'/')+'&limit=100')
    return { files: (r._embedded?.items||[]).map((i:any)=>this.mf(i)), hasMore: r._embedded?.has_more || false }
  }

  async uploadFile(f: File, o?: UploadOptions): Promise<FileMetadata> {
    const path = (o?.folderId||'/') + '/' + (o?.fileName||f.name)
    const uRes = await this.req('/disk/resources/upload?path='+encodeURIComponent(path))
    await this.proxyFetch(uRes.href, { method: 'PUT', body: f })
    return this.mf({ name: o?.fileName||f.name, path, size: f.size, created: new Date().toISOString(), modified: new Date().toISOString() })
  }

  async downloadFile(id: string): Promise<Blob> {
    const r = await this.req('/disk/resources/download?path='+encodeURIComponent(id))
    return (await this.proxyFetch(r.href)).blob()
  }

  async deleteFile(id: string): Promise<void> { await this.req('/disk/resources?path='+encodeURIComponent(id), 'DELETE') }
  async createFolder(name: string, pid?: string): Promise<FileMetadata> {
    const path = (pid||'/') + '/' + name
    await this.req('/disk/resources?path='+encodeURIComponent(path), 'PUT')
    return this.mf({ name, path, created: new Date().toISOString(), modified: new Date().toISOString() })
  }
  async getShareLink(id: string): Promise<string | null> {
    try { const r = await this.req('/disk/resources/publish?path='+encodeURIComponent(id)); return r.public_url } catch { return null }
  }
  async searchFiles(o: { query: string }): Promise<SearchResult> {
    const r = await this.req('/disk/resources/search?query='+encodeURIComponent(o.query)+'&limit=100')
    return { files: (r.items||[]).map((i:any)=>this.mf(i)), hasMore: r._embedded?.has_more || false }
  }
  async getFile(id: string): Promise<FileMetadata> {
    const r = await this.req('/disk/resources?path=' + encodeURIComponent(id))
    return this.mf(r)
  }
  async moveFile(id: string, pid: string): Promise<FileMetadata> {
    const name = id.split('/').pop() || ''
    const newPath = (pid === '/' ? '' : pid) + '/' + name
    await this.req('/disk/resources/move?from=' + encodeURIComponent(id) + '&path=' + encodeURIComponent(newPath), 'POST')
    return this.getFile(newPath)
  }
  async copyFile(id: string, pid: string): Promise<FileMetadata> {
    const name = id.split('/').pop() || ''
    const newPath = (pid === '/' ? '' : pid) + '/' + name
    await this.req('/disk/resources/copy?from=' + encodeURIComponent(id) + '&path=' + encodeURIComponent(newPath), 'POST')
    return this.getFile(newPath)
  }
  async renameFile(id: string, name: string): Promise<FileMetadata> {
    const parts = id.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    const newPath = (parentPath === '/' ? '' : parentPath) + '/' + name
    await this.req('/disk/resources/move?from=' + encodeURIComponent(id) + '&path=' + encodeURIComponent(newPath), 'POST')
    return this.getFile(newPath)
  }
  async revokeShareLink(id: string): Promise<void> {
    await this.req('/disk/resources/unpublish?path=' + encodeURIComponent(id), 'PUT')
  }

  private async req(ep: string, method: string = 'GET'): Promise<any> {
    this.ensureActiveToken()
    if (!this.accessToken && !this.remoteId) { const t = tokenManager.getToken('yandex'); if (!t) throw new Error('Not auth'); this.accessToken = t.accessToken }
    const res = await this.proxyFetch(YANDEX_API_BASE+ep, { 
      method, 
      headers: { 
        ...(this.accessToken && !this.remoteId ? { Authorization: 'Bearer '+this.accessToken } : {})
      } 
    })
    if (res.status===401) { const nt = await tokenManager.refreshToken('yandex'); if (nt) { this.accessToken = nt.accessToken; return this.req(ep,method) } }
    if (!res.ok) throw new Error('Yandex API error')
    return res.json()
  }

  private mf(i: any): FileMetadata {
    const f = i.type === 'dir'
    return { id: i.path, name: i.name, path: i.path, pathDisplay: i.path, size: i.size||0, mimeType: f?'application/vnd.folder':formatMimeType(i.name), isFolder: f, createdTime: i.created, modifiedTime: i.modified, provider: 'yandex', providerName: 'Yandex Disk' }
  }
}

export const yandexProvider = new YandexProvider()
