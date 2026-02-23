const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

export async function apiFetch(path: string, opts: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  return res
}

export async function login(email: string, password: string) {
  const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
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

export async function uploadFile(file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API}/files/upload`, {
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
