/**
 * pCloud Provider Adapter
 * Implements client-side OAuth for pCloud
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

const PCLOUD_CLIENT_ID = process.env.NEXT_PUBLIC_PCLOUD_CLIENT_ID || 'YOUR_PCLOUD_CLIENT_ID'
const PCLOUD_AUTH_BASE = 'https://my.pcloud.com/oauth2'
const PCLOUD_API_BASE = 'https://api.pcloud.com'

export class PCloudProvider extends StorageProvider {
  readonly id: ProviderId = 'pcloud'
  readonly name: string = 'pCloud'

  private accessToken: string | null = null

  constructor() {
    super()
    if (typeof window !== 'undefined') {
      this.loadToken()
    }
  }

  private loadToken(): void {
    const token = tokenManager.getToken('pcloud')
    if (token) this.accessToken = token.accessToken
  }

  async connect(): Promise<ProviderToken> {
    if (typeof window === 'undefined') throw new Error('Cannot connect on server')

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    sessionStorage.setItem('pcloud_code_verifier', codeVerifier)

    const authUrl = new URL(`${PCLOUD_AUTH_BASE}/authorize`)
    authUrl.searchParams.set('client_id', PCLOUD_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri())

    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl.toString(), 'pCloud Connect', 'width=600,height=700')
      if (!popup) { reject(new Error('Popup blocked')); return }

      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'pcloud_auth_code') {
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
    const cv = sessionStorage.getItem('pcloud_code_verifier')
    sessionStorage.removeItem('pcloud_code_verifier')

    const res = await fetch(`${PCLOUD_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: PCLOUD_CLIENT_ID,
        redirect_uri: this.getRedirectUri(),
        code_verifier: cv || '',
      }),
    })
    if (!res.ok) throw new Error('Token exchange failed')
    const data = await res.json()

    const token: ProviderToken = {
      provider: 'pcloud',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      accountEmail: data.email || 'pCloud User',
      displayName: data.name || 'pCloud User',
    }
    tokenManager.saveToken('pcloud', token)
    this.accessToken = token.accessToken
    tokenManager.onRefresh('pcloud', (t) => this.refreshToken(t))
    tokenManager.startAutoRefresh('pcloud', token)
    return token
  }

  async disconnect(): Promise<void> { tokenManager.removeToken('pcloud'); this.accessToken = null }

  async refreshToken(t: ProviderToken): Promise<ProviderToken> {
    if (!t.refreshToken) throw new Error('No refresh token')
    const res = await fetch(`${PCLOUD_AUTH_BASE}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: PCLOUD_CLIENT_ID })
    })
    if (!res.ok) throw new Error('Refresh failed')
    const data = await res.json()
    const nt = { ...t, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null }
    this.accessToken = nt.accessToken
    tokenManager.saveToken('pcloud', nt)
    tokenManager.startAutoRefresh('pcloud', nt)
    return nt
  }

  isTokenValid(t: ProviderToken | null): boolean { return tokenManager.isTokenValid(t) }

  async getQuota(): Promise<ProviderQuota> {
    const r = await this.req('/getuserquota')
    const used = r.usedquota ?? r.used ?? 0
    const total = r.quota ?? r.totalquota ?? 0
    const free = Math.max(total - used, 0)
    return { used: used, total: total, free, usedDisplay: formatBytes(used), totalDisplay: formatBytes(total), freeDisplay: formatBytes(free), percentUsed: total > 0 ? (used/total)*100 : 0 }
  }

  async listFiles(o?: { folderId?: string }): Promise<ListFilesResult> {
    const r = await this.req('/listfolder', { folderid: o?.folderId || '0' })
    const contents = r.metadata?.contents || r.contents || []
    return { files: (contents as any[]).map((i:any)=>this.mf(i)), hasMore: false }
  }

  async uploadFile(f: File, o?: UploadOptions): Promise<FileMetadata> {
    const fd = new FormData(); fd.append('file', f); fd.append('folderid', o?.folderId||'0'); fd.append('filename', o?.fileName||f.name)
    const token = this.ensureAccessToken()
    const res = await fetch(PCLOUD_API_BASE+'/uploadfile', { 
      method: 'POST', 
      body: fd,
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json()
    const meta = Array.isArray(data.metadata) ? data.metadata[0] : data.metadata || data.file || data
    return this.mf(meta)
  }

  async downloadFile(id: string): Promise<Blob> {
    const r = await this.req('/getfilelink', { fileid: id })
    const host = Array.isArray(r.hosts) ? r.hosts[0] : undefined
    const link = r.getfilelink || r.link || r.downloadlink || (host && r.path ? `https://${host}${r.path}` : undefined)
    if (!link) throw new Error('Download link unavailable')
    const token = this.ensureAccessToken()
    const res = await fetch(link, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Download failed')
    return res.blob()
  }

  async deleteFile(id: string): Promise<void> { await this.req('/deletefile', { fileid: id }) }
  async createFolder(name: string, pid?: string): Promise<FileMetadata> {
    const r = await this.req('/createfolder', { folderid: pid || '0', name })
    return this.mf(r.metadata || r)
  }
  async getShareLink(id: string): Promise<string | null> {
    try {
      const r = await this.req('/getfilepublink', { fileid: id })
      const link = r.link || r.shortlink || r.publiclink
      return link ? String(link) : null
    } catch {
      return null
    }
  }
  async searchFiles(o: { query: string }): Promise<SearchResult> {
    const r = await this.req('/search', { query: o.query })
    const matches = r.matches || r.metadata || []
    return { files: (matches as any[]).map((i:any)=>this.mf(i)), hasMore: false }
  }
  async getFile(id: string): Promise<FileMetadata> {
    const r = await this.req('/stat', { fileid: id })
    const meta = Array.isArray(r.metadata) ? r.metadata[0] : r.metadata || r
    return this.mf(meta)
  }
  async moveFile(id: string, pid: string): Promise<FileMetadata> {
    const r = await this.req('/movefile', { fileid: id, tofolderid: pid })
    return this.mf(r.metadata || r)
  }
  async copyFile(id: string, pid: string): Promise<FileMetadata> {
    const r = await this.req('/copyfile', { fileid: id, tofolderid: pid })
    return this.mf(r.metadata || r)
  }
  async renameFile(id: string, name: string): Promise<FileMetadata> {
    const r = await this.req('/renamefile', { fileid: id, toname: name })
    return this.mf(r.metadata || r)
  }
  async revokeShareLink(id: string): Promise<void> {
    try {
      await this.req('/deletepublink', { fileid: id })
    } catch {}
  }

  private async req(ep: string, params?: Record<string, any>, method: 'GET' | 'POST' = 'GET', retried = false): Promise<any> {
    const token = this.ensureAccessToken()
    const url = new URL(PCLOUD_API_BASE + ep)
    const isGet = method === 'GET'
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }

    let body: BodyInit | undefined
    if (params) {
      if (isGet) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
      } else {
        body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
    }

    const res = await fetch(url.toString(), { method, headers, body })
    if (res.status === 401 && !retried) {
      const nt = await tokenManager.refreshToken('pcloud')
      if (nt) {
        this.accessToken = nt.accessToken
        return this.req(ep, params, method, true)
      }
      throw new Error('SESSION_EXPIRED')
    }

    const d = await res.json()
    if (d.result !== 0) throw new Error(d.error || 'pCloud error')
    return d
  }

  private ensureAccessToken(): string {
    if (!this.accessToken) {
      const token = tokenManager.getToken('pcloud')
      if (!token) throw new Error('Not authenticated')
      this.accessToken = token.accessToken
    }
    return this.accessToken
  }

  private getRedirectUri(): string {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/api/auth/pcloud/callback`
  }

  private mf(i: any): FileMetadata {
    const f = !!i.isfolder
    return { id: String(i.fileid||i.folderid), name: i.name, path: i.path||'/' + i.name, pathDisplay: i.path || i.pathDisplay || '/' + i.name, size: i.size||0, mimeType: f?'application/vnd.folder':formatMimeType(i.name), isFolder: f, createdTime: i.created, modifiedTime: i.modified, provider: 'pcloud', providerName: 'pCloud' }
  }
}

export const pcloudProvider = new PCloudProvider()
