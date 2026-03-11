import { getPublicApiUrl } from './config'
import { authInterceptor } from './interceptors/authInterceptor'

const API = getPublicApiUrl()

export async function apiFetch(path: string, opts: RequestInit = {}, token?: string, timeoutMs = 15000) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const externalSignal = opts.signal
  const controller = externalSignal ? null : new AbortController()
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const res = await authInterceptor(`${API}${path}`, {
      ...opts,
      headers,
      credentials: opts.credentials || 'include', // Ensure credentials are included by default
      signal: externalSignal || controller?.signal
    })
    return res
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function login(email: string, password: string) {
  // Route login through Next API so HttpOnly auth cookies are set consistently.
  const res = await authInterceptor('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  return res.json()
}

export async function register(email: string, password: string) {
  const res = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }, undefined, 8000)
  return res.json()
}

export async function getFiles(token: string) {
  const res = await apiFetch('/files', {}, token)
  return res.json()
}

export async function getUsage(token: string) {
  const res = await apiFetch('/files/usage', {}, token)
  return res.json()
}

export async function deleteFile(id: string, token: string) {
  const res = await apiFetch(`/files/${id}`, { method: 'DELETE' }, token)
  return res.json()
}

export async function retryFile(id: string, token: string) {
  const res = await apiFetch(`/files/${id}/retry`, { method: 'POST' }, token)
  return res.json()
}

export async function uploadFile(file: File, token: string, path?: string) {
  const formData = new FormData()
  formData.append('file', file)

  const url = path ? `/files/upload?path=${encodeURIComponent(path)}` : '/files/upload'
  const res = await authInterceptor(`${API}${url}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type - browser will set it with boundary for multipart/form-data
    },
    body: formData,
    credentials: 'include'
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || `Upload failed with status ${res.status}`)
  }

  // Return the created file object to enable downstream operations
  const result = await res.json()
  return result.file || result // Return file object if available, otherwise return full response
}

export async function downloadFile(id: string, filename: string, token: string) {
  const res = await apiFetch(`/files/${id}/download`, {}, token)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function createShareLink(id: string, token: string, password?: string, expiryHours?: number) {
  const body: Record<string, unknown> = {}
  if (password) body.password = password
  if (expiryHours) body.expires_in_hours = expiryHours
  const res = await apiFetch(`/files/${id}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, token)
  if (!res.ok) throw new Error(`Share failed: ${res.status}`)
  return res.json()
}

export async function renameFile(id: string, newName: string, token: string) {
  const res = await apiFetch(`/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ path: newName })
  }, token)
  if (!res.ok) throw new Error(`Rename failed: ${res.status}`)
  return res.json()
}

export async function resolveConflict(id: string, resolution: 'keep_local' | 'keep_remote', token: string) {
  const res = await apiFetch(`/conflicts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution })
  }, token)

  if (!res.ok) {
    throw new Error(`Resolution failed: ${res.status}`)
  }

  return res.json()
}

// File browser APIs
export async function browseFiles(path: string, token: string, locationId?: string) {
  const qs = new URLSearchParams({ path })
  if (locationId) qs.set('location', locationId)
  const res = await apiFetch(`/files/browse?${qs.toString()}`, {}, token)
  if (!res.ok) throw new Error(`Browse failed: ${res.status}`)
  return res.json()
}

export async function createFolder(path: string, token: string) {
  const res = await apiFetch('/files/folders', {
    method: 'POST',
    body: JSON.stringify({ path })
  }, token)
  if (!res.ok) throw new Error(`Create folder failed: ${res.status}`)
  return res.json()
}

export async function deleteFolder(path: string, token: string) {
  const res = await apiFetch(`/files/folders?path=${encodeURIComponent(path)}`, {
    method: 'DELETE'
  }, token)
  if (!res.ok) throw new Error(`Delete folder failed: ${res.status}`)
  return res.json()
}

export async function moveFile(fileId: string, newPath: string, token: string) {
  const res = await apiFetch(`/files/${fileId}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ newPath })
  }, token)
  if (!res.ok) throw new Error(`Move file failed: ${res.status}`)
  return res.json()
}

// Storage APIs
export async function getStorageLocations(token: string) {
  const res = await apiFetch('/storage/locations', {}, token)
  if (!res.ok) throw new Error(`Get storage locations failed: ${res.status}`)
  return res.json()
}

export async function getStorageUsage(token: string) {
  const res = await apiFetch('/storage/usage', {}, token)
  if (!res.ok) throw new Error(`Get storage usage failed: ${res.status}`)
  return res.json()
}

// Cloud Remotes APIs
export async function getRemotes(token: string) {
  const res = await apiFetch('/remotes', {}, token)
  if (!res.ok) throw new Error(`Get remotes failed: ${res.status}`)
  return res.json()
}

export async function browseRemote(name: string, path: string, token: string) {
  const res = await apiFetch(`/remotes/${encodeURIComponent(name)}/browse?path=${encodeURIComponent(path)}`, {}, token)
  if (!res.ok) throw new Error(`Browse remote failed: ${res.status}`)
  return res.json()
}

export async function addRemote(name: string, type: string, provider: string, config: Record<string, string>, token: string) {
  const res = await apiFetch('/remotes', {
    method: 'POST',
    body: JSON.stringify({ name, type, provider, config })
  }, token)
  if (!res.ok) throw new Error(`Add remote failed: ${res.status}`)
  return res.json()
}

export async function deleteRemote(name: string, token: string) {
  const res = await apiFetch(`/remotes/${encodeURIComponent(name)}`, { method: 'DELETE' }, token)
  if (!res.ok) throw new Error(`Delete remote failed: ${res.status}`)
  return res.json()
}

// CSRF nonce helpers for OAuth flows
const CSRF_NONCE_KEY = 'cacheflow_oauth_nonce'

export function generateOAuthNonce(): string {
  const nonce = crypto.randomUUID()
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CSRF_NONCE_KEY, nonce)
  }
  return nonce
}

export function verifyOAuthNonce(nonce: string): boolean {
  if (typeof window === 'undefined') return false
  const stored = sessionStorage.getItem(CSRF_NONCE_KEY)
  if (stored === nonce) {
    sessionStorage.removeItem(CSRF_NONCE_KEY)
    return true
  }
  return false
}

// Connect Google Drive with credentials - client_secret removed for security
export async function connectGoogleDrive(
  name: string,
  credentials: { client_id: string },
  token: string
): Promise<{ success: boolean; authUrl?: string; needsAuth?: boolean }> {
  const res = await apiFetch('/remotes/google/connect', {
    method: 'POST',
    body: JSON.stringify({ name, credentials })
  }, token)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to connect' }))
    throw new Error(err.error || `Connect failed: ${res.status}`)
  }
  return res.json()
}

// Complete Google Drive OAuth with auth code - client_secret removed for security
export async function completeGoogleAuth(
  name: string,
  credentials: { client_id: string },
  authCode: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await apiFetch('/remotes/google/connect', {
    method: 'POST',
    body: JSON.stringify({ name, credentials, authCode })
  }, token)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to complete auth' }))
    throw new Error(err.error || `Complete auth failed: ${res.status}`)
  }
  return res.json()
}

export async function setRemoteToken(name: string, token: string, authToken: string, credentials?: string) {
  const res = await apiFetch(`/remotes/${encodeURIComponent(name)}/token`, {
    method: 'POST',
    body: JSON.stringify({ token, credentials })
  }, authToken)
  if (!res.ok) throw new Error(`Set token failed: ${res.status}`)
  return res.json()
}

export async function copyFromRemote(remoteName: string, remotePath: string, localPath: string, token: string) {
  const res = await apiFetch(`/remotes/${encodeURIComponent(remoteName)}/copy`, {
    method: 'POST',
    body: JSON.stringify({ remotePath, localPath })
  }, token)
  if (!res.ok) throw new Error(`Copy from remote failed: ${res.status}`)
  return res.json()
}

// Production-grade API helpers
export async function apiRenameFile(id: string, newName: string, token: string, correlationId?: string) {
  const headers: Record<string, string> = {}
  if (correlationId) headers['X-Correlation-Id'] = correlationId
  
  const res = await apiFetch('/api/files/rename', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ id, newName })
  }, token)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Rename failed: ${res.status}`)
  return data
}

export async function apiMoveFile(id: string, newParentPath: string, token: string, correlationId?: string) {
  const headers: Record<string, string> = {}
  if (correlationId) headers['X-Correlation-Id'] = correlationId
  
  const res = await apiFetch('/api/files/move', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id, newParentPath })
  }, token)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Move failed: ${res.status}`)
  return data
}

export async function apiDownloadFile(id: string, filename: string, token: string, correlationId?: string) {
  const headers: Record<string, string> = {}
  if (correlationId) headers['X-Correlation-Id'] = correlationId
  
  const res = await apiFetch('/api/files/download', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id })
  }, token)
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }))
    throw new Error(err.error || `Download failed: ${res.status}`)
  }
  
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function apiCreateShareLink(id: string, token: string, options: { password?: string, expiryHours?: number, correlationId?: string } = {}) {
  const headers: Record<string, string> = {}
  if (options.correlationId) headers['X-Correlation-Id'] = options.correlationId
  
  const body: Record<string, unknown> = { id }
  if (options.password) body.password = options.password
  if (options.expiryHours) body.expires_in_hours = options.expiryHours
  
  const res = await apiFetch('/api/share', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  }, token)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Share failed: ${res.status}`)
  return data
}
