import { getPublicApiUrl } from './config'

const API = getPublicApiUrl()

export async function apiFetch(path: string, opts: RequestInit = {}, token?: string, timeoutMs = 15000) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const externalSignal = opts.signal
  const controller = externalSignal ? null : new AbortController()
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers,
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
  const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, undefined, 8000)
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
  const res = await fetch(`${API}${url}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type - browser will set it with boundary for multipart/form-data
    },
    body: formData
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || `Upload failed with status ${res.status}`)
  }

  return res.json()
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

export async function copyFromRemote(remoteName: string, remotePath: string, localPath: string, token: string) {
  const res = await apiFetch(`/remotes/${encodeURIComponent(remoteName)}/copy`, {
    method: 'POST',
    body: JSON.stringify({ remotePath, localPath })
  }, token)
  if (!res.ok) throw new Error(`Copy from remote failed: ${res.status}`)
  return res.json()
}
