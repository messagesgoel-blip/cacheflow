/**
 * pCloud Provider Adapter
 * Implements client-side OAuth for pCloud
 */

import { StorageProvider, ListFilesResult, DownloadOptions, UploadOptions, SearchResult } from './StorageProvider'
import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'
import { tokenManager } from '../tokenManager'

const PCLOUD_CLIENT_ID = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_PCLOUD_CLIENT_ID || 'YOUR_PCLOUD_CLIENT_ID') : ''
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

    const authUrl = new URL('https://my.pcloud.com/oauth2/authorize')
    authUrl.searchParams.set('client_id', PCLOUD_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('redirect_uri', window.location.origin + '/api/auth/pcloud/callback')

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
    
    const res = await fetch('https://my.pcloud.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code', client_id: PCLOUD_CLIENT_ID,
        redirect_uri: window.location.origin + '/api/auth/pcloud/callback', code_verifier: cv || ''
      })
    })
    if (!res.ok) throw new Error('Token exchange failed')
    const data = await res.json()
    
    const token: ProviderToken = {
      provider: 'pcloud', accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      accountEmail: data.email || 'pCloud User', displayName: data.name || 'pCloud User'
    }
    tokenManager.saveToken('pcloud', token)
    this.accessToken = token.accessToken
    tokenManager.onRefresh('pcloud', t => this.refreshToken(t))
    return token
  }

  async disconnect(): Promise<void> { tokenManager.removeToken('pcloud'); this.accessToken = null }

  async refreshToken(t: ProviderToken): Promise<ProviderToken> {
    if (!t.refreshToken) throw new Error('No refresh token')
    const res = await fetch('https://my.pcloud.com/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: PCLOUD_CLIENT_ID })
    })
    if (!res.ok) throw new Error('Refresh failed')
    const data = await res.json()
    const nt = { ...t, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null }
    this.accessToken = nt.accessToken
    tokenManager.saveToken('pcloud', nt)
    return nt
  }

  isTokenValid(t: ProviderToken | null): boolean { return tokenManager.isTokenValid(t) }

  async getQuota(): Promise<ProviderQuota> {
    const r = await this.req('/getuserquota')
    const u = r.used, tot = r.quota
    return { used: u, total: tot, free: tot - u, usedDisplay: fb(u), totalDisplay: fb(tot), freeDisplay: fb(tot - u), percentUsed: tot > 0 ? (u/tot)*100 : 0 }
  }

  async listFiles(o?: { folderId?: string }): Promise<ListFilesResult> {
    const r = await this.req('/listfolder', { folderid: o?.folderId || '0' })
    return { files: (r.contents||[]).map((i:any)=>this.mf(i)), hasMore: false }
  }

  async uploadFile(f: File, o?: UploadOptions): Promise<FileMetadata> {
    const fd = new FormData(); fd.append('file', f); fd.append('folderid', o?.folderId||'0'); fd.append('filename', o?.fileName||f.name)
    const res = await fetch(PCLOUD_API_BASE+'/uploadfile?access_token='+this.accessToken, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload failed')
    return this.mf((await res.json()).metadata)
  }

  async downloadFile(id: string): Promise<Blob> {
    const r = await this.req('/getfilelink', { fileid: id })
    return (await fetch(r.getfilelink)).blob()
  }

  async deleteFile(id: string): Promise<void> { await this.req('/deletefile', { fileid: id }) }
  async createFolder(name: string, pid?: string): Promise<FileMetadata> {
    const r = await this.req('/createfolder', { folderid: pid || '0', name })
    return this.mf(r.metadata)
  }
  async getShareLink(id: string): Promise<string | null> {
    try { const r = await this.req('/getsharename', { fileid: id }); return 'https://my.pcloud.com/#page=publink&code='+r.code } catch { return null }
  }
  async searchFiles(o: { query: string }): Promise<SearchResult> {
    const r = await this.req('/search', { query: o.query })
    return { files: (r.matches||[]).map((i:any)=>this.mf(i)), hasMore: false }
  }
  async getFile(id: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async moveFile(id: string, pid: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async copyFile(id: string, pid: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async renameFile(id: string, name: string): Promise<FileMetadata> { throw new Error('Not implemented') }
  async revokeShareLink(id: string): Promise<void> { throw new Error('Not implemented') }

  private async req(ep: string, body?: any): Promise<any> {
    if (!this.accessToken) { const t = tokenManager.getToken('pcloud'); if (!t) throw new Error('Not auth'); this.accessToken = t.accessToken }
    const u = new URL(PCLOUD_API_BASE+ep)
    if (this.accessToken) u.searchParams.set('access_token', this.accessToken)
    if (body) Object.entries(body).forEach(([k,v]) => u.searchParams.set(k, String(v)))
    const res = await fetch(u.toString())
    if (res.status===401) { const nt = await tokenManager.refreshToken('pcloud'); if (nt) { this.accessToken = nt.accessToken; return this.req(ep,body) } }
    const d = await res.json()
    if (d.result!==0) throw new Error('pCloud error')
    return d
  }

  private mf(i: any): FileMetadata {
    const f = !!i.isfolder
    return { id: String(i.fileid||i.folderid), name: i.name, path: i.path||'/'+i.name, pathDisplay: i.path, size: i.size||0, mimeType: f?'application/vnd.folder':gm(i.name), isFolder: f, createdTime: i.created, modifiedTime: i.modified, provider: 'pcloud', providerName: 'pCloud' }
  }
}

function gm(n: string): string { const e=n.split('.').pop()?.toLowerCase(), m:Record<string,string>={jpg:'image/jpeg',png:'image/gif',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',mp3:'audio/mpeg',mp4:'video/mp4',zip:'application/zip'}; return m[e||'']||'application/octet-stream' }
function fb(b: number): string { if(!b)return'0 B';const k=1024,s=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(b)/Math.log(k)); return (b/Math.pow(k,i)).toFixed(2)+' '+s[i] }
function generateCodeVerifier(): string { const a=new Uint8Array(32); crypto.getRandomValues(a); return btoa(String.fromCharCode(...Array.from(a))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') }
async function generateCodeChallenge(v: string): Promise<string> { const e=new TextEncoder().encode(v), d=await crypto.subtle.digest('SHA-256',e); return btoa(String.fromCharCode(...Array.from(new Uint8Array(d)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') }

export const pcloudProvider = new PCloudProvider()
