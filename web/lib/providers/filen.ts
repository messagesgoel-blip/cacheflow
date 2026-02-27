/**
 * Filen Provider Adapter
 * Implements client-side OAuth for Filen (E2E Encrypted Cloud Storage)
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

const FILEN_CLIENT_ID = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_FILEN_CLIENT_ID || 'YOUR_FILEN_CLIENT_ID') : ''
const FILEN_API_BASE = 'https://api.filen.io'

export class FilenProvider extends StorageProvider {
  readonly id: ProviderId = 'filen'
  readonly name: string = 'Filen'

  private accessToken: string | null = null

  constructor() {
    super()
    if (typeof window !== 'undefined') {
      this.loadToken()
    }
  }

  private loadToken(): void {
    const token = tokenManager.getToken('filen')
    if (token) this.accessToken = token.accessToken
  }

  async connect(): Promise<ProviderToken> {
    if (typeof window === 'undefined') throw new Error('Cannot connect on server')

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    sessionStorage.setItem('filen_code_verifier', codeVerifier)

    const authUrl = new URL('https://filen.io/oauth/authorize')
    authUrl.searchParams.set('client_id', FILEN_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('redirect_uri', window.location.origin + '/api/auth/filen/callback')
    authUrl.searchParams.set('scope', 'files:read files:write user:read')

    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'Filen Connect', 'width=600,height=700')
      if (!popup) { reject(new Error('Popup blocked')); return }

      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'filen_auth_code') {
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
    const cv = sessionStorage.getItem('filen_code_verifier')
    sessionStorage.removeItem('filen_code_verifier')
    
    const res = await fetch('https://filen.io/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code', client_id: FILEN_CLIENT_ID,
        redirect_uri: window.location.origin + '/api/auth/filen/callback', code_verifier: cv || ''
      })
    })
    if (!res.ok) throw new Error('Token exchange failed')
    const data = await res.json()
    
    const token: ProviderToken = {
      provider: 'filen', accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      accountEmail: data.email || 'Filen User', displayName: data.email?.split('@')[0] || 'Filen User'
    }
    tokenManager.saveToken('filen', token)
    this.accessToken = token.accessToken
    tokenManager.onRefresh('filen', t => this.refreshToken(t))
    return token
  }

  async disconnect(): Promise<void> { tokenManager.removeToken('filen'); this.accessToken = null }

  async refreshToken(t: ProviderToken): Promise<ProviderToken> {
    if (!t.refreshToken) throw new Error('No refresh token')
    const res = await fetch('https://filen.io/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: FILEN_CLIENT_ID })
    })
    if (!res.ok) throw new Error('Refresh failed')
    const data = await res.json()
    const nt = { ...t, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null }
    this.accessToken = nt.accessToken
    tokenManager.saveToken('filen', nt)
    return nt
  }

  isTokenValid(t: ProviderToken | null): boolean { return tokenManager.isTokenValid(t) }

  async getQuota(): Promise<ProviderQuota> {
    const r = await this.req('/v1/user/space')
    const u = r.data.used, tot = r.data.total
    return { used: u, total: tot, free: tot - u, usedDisplay: formatBytes(u), totalDisplay: formatBytes(tot), freeDisplay: formatBytes(tot - u), percentUsed: tot > 0 ? (u/tot)*100 : 0 }
  }

  async listFiles(o?: { folderId?: string }): Promise<ListFilesResult> {
    const r = await this.req('/v1/dir/list', { uuid: o?.folderId || '' })
    return { files: (r.data||[]).map((i:any)=>this.mf(i)), hasMore: false }
  }

  async uploadFile(f: File, o?: UploadOptions): Promise<FileMetadata> {
    const fd = new FormData(); fd.append('file', f); fd.append('parent', o?.folderId||''); fd.append('name', o?.fileName||f.name)
    const res = await fetch(FILEN_API_BASE+'/v1/file/upload', { 
      method: 'POST', 
      body: fd,
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    if (!res.ok) throw new Error('Upload failed')
    return this.mf((await res.json()).data)
  }

  async downloadFile(id: string): Promise<Blob> {
    const res = await fetch(FILEN_API_BASE+'/v1/file/download?uuid='+id, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    if (!res.ok) throw new Error('Download failed')
    return res.blob()
  }

  async deleteFile(id: string): Promise<void> { await this.req('/v1/file/delete', { uuid: id }) }
  async createFolder(name: string, pid?: string): Promise<FileMetadata> {
    const r = await this.req('/v1/dir/create', { name, parent: pid || '' })
    return this.mf(r.data)
  }
  async getShareLink(id: string): Promise<string | null> {
    try { const r = await this.req('/v1/file/link', { uuid: id }); return r.data } catch { return null }
  }
  async searchFiles(o: { query: string }): Promise<SearchResult> {
    const r = await this.req('/v1/search', { query: o.query })
    return { files: (r.data||[]).map((i:any)=>this.mf(i)), hasMore: false }
  }
  async getFile(id: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async moveFile(id: string, pid: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async copyFile(id: string, pid: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async renameFile(id: string, name: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async revokeShareLink(id: string): Promise<void> { throw new Error('Not implemented') }

  private async req(ep: string, body?: any, retried = false, method = 'POST'): Promise<any> {
    if (!this.accessToken) { const t = tokenManager.getToken('filen'); if (!t) throw new Error('Not auth'); this.accessToken = t.accessToken }
    const res = await fetch(FILEN_API_BASE+ep, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`
      },
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined
    })
    if (res.status === 401 && !retried) { 
      const nt = await tokenManager.refreshToken('filen')
      if (nt) { 
        this.accessToken = nt.accessToken
        return this.req(ep, body, true, method)
      }
      throw new Error('SESSION_EXPIRED')
    }
    const d = await res.json()
    if (!d.success) throw new Error(d.errorMessage || 'Filen error')
    return d
  }

  private mf(i: any): FileMetadata {
    const f = i.type === 'folder'
    return { id: i.uuid, name: i.name, path: i.path||'/'+i.name, pathDisplay: i.path, size: i.size||0, mimeType: f?'application/vnd.folder':formatMimeType(i.name), isFolder: f, createdTime: i.createdAt, modifiedTime: i.updatedAt, provider: 'filen', providerName: 'Filen' }
  }
}

export const filenProvider = new FilenProvider()
