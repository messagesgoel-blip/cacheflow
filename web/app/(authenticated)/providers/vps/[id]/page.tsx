'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { normalizePath, joinPath } from '@/lib/utils/path'

interface VpsItem {
  name: string
  type: 'file' | 'dir'
  size: number
  modifiedAt?: string | null
}

const MOCK_RUN_PATH = '/srv/storage/local/mock run'

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatVpsDate(value?: string | null): string {
  if (!value) return 'No timestamp'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function parentPath(input: string): string {
  if (input === '/') return '/'
  const normalized = input.replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalized.slice(0, idx)
}

function emitVpsFilesChanged(connectionId: string, folderPath: string) {
  if (typeof window === 'undefined' || !connectionId) return
  window.dispatchEvent(new CustomEvent('cacheflow:vps-files-changed', {
    detail: {
      connectionId,
      folderPath: normalizePath(folderPath),
    },
  }))
}

export default function VpsBrowserPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const actions = useActionCenter()
  const id = String(params?.id || '')
  const [path, setPath] = useState('/')
  const [items, setItems] = useState<VpsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mkdirName, setMkdirName] = useState('')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [showingPublicKey, setShowingPublicKey] = useState(false)
  const latestLoadId = useRef(0)

  const canGoUp = useMemo(() => path !== '/', [path])

  const load = useCallback(async (targetPath: string) => {
    if (!id) return
    const requestId = ++latestLoadId.current
    setLoading(true)
    setError(null)
    const normalized = normalizePath(targetPath)
    
    // Safe-path check: ensure path is within root
    if (!normalized.startsWith('/')) {
      setError('Invalid path: must start with /')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(
        `/api/providers/vps/${id}/files?path=${encodeURIComponent(normalized)}`,
        { credentials: 'include', cache: 'no-store' }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || payload?.error || 'Failed to load files')
      }
      const payload = await response.json()
      if (requestId !== latestLoadId.current) return
      setItems(Array.isArray(payload) ? payload : [])
      setPath(normalized)
    } catch (err: any) {
      if (requestId !== latestLoadId.current) return
      setError(err?.message || 'Failed to load files')
      setItems([])
    } finally {
      if (requestId !== latestLoadId.current) return
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load('/')
  }, [load])

  const handleUpload = async () => {
    if (!selectedFile) return
    const target = path.endsWith('/') ? path : `${path}/`
    const form = new FormData()
    form.append('file', selectedFile)
    try {
      const response = await fetch(`/api/providers/vps/${id}/files/upload?path=${encodeURIComponent(target)}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || payload?.error || 'Upload failed')
      }
      actions.notify({ kind: 'success', title: 'Uploaded', message: selectedFile.name })
      setSelectedFile(null)
      emitVpsFilesChanged(id, path)
      await load(path)
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Upload failed', message: err?.message || 'Upload failed' })
    }
  }

  const handleDelete = async (item: VpsItem) => {
    const remotePath = joinPath(path, item.name)
    try {
      const response = await fetch(`/api/providers/vps/${id}/files?path=${encodeURIComponent(remotePath)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || payload?.error || 'Delete failed')
      }
      emitVpsFilesChanged(id, path)
      await load(path)
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Delete failed', message: err?.message || 'Delete failed' })
    }
  }

  const handleMkdir = async () => {
    if (!mkdirName.trim()) return
    const remotePath = joinPath(path, mkdirName.trim())
    try {
      const response = await fetch(`/api/providers/vps/${id}/files/mkdir?path=${encodeURIComponent(remotePath)}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || payload?.error || 'mkdir failed')
      }
      setMkdirName('')
      emitVpsFilesChanged(id, path)
      await load(path)
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Create folder failed', message: err?.message || 'Create folder failed' })
    }
  }

  const loadPublicKey = async () => {
    if (publicKey) {
      setShowingPublicKey(!showingPublicKey)
      return
    }
    try {
      const response = await fetch(`/api/providers/vps/${id}/public-key`, { credentials: 'include' })
      const result = await response.json()
      if (response.ok) {
        setPublicKey(result.publicKey)
        setShowingPublicKey(true)
      } else {
        actions.notify({ kind: 'error', title: 'Failed to load public key', message: result.error || 'Unknown error' })
      }
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Failed to load public key', message: err.message })
    }
  }

  return (
    <div>
      
      <main className="mx-auto max-w-[1500px] p-5 sm:p-6">
        <div data-testid="cf-vps-detail-shell" className="cf-panel overflow-hidden rounded-[32px]">
          <div className="grid gap-4 border-b border-[var(--cf-border)] px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.4fr)_360px]">
            <div>
              <div className="cf-kicker">VPS Detail</div>
              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-[var(--cf-text-0)]">VPS File Browser</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cf-text-1)]">
                Focused shell for safe QA work inside the saved VPS connection. Keep browser operations inside the mock run tree.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="min-w-[200px] rounded-[20px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="cf-kicker">Connection ID</div>
                    <button
                      onClick={loadPublicKey}
                      className="text-[10px] font-bold text-[var(--cf-blue)] uppercase hover:underline"
                    >
                      {showingPublicKey ? 'Hide Public Key' : 'Show Public Key'}
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-sm text-[var(--cf-text-1)]">{id}</div>
                </div>
                <div className="rounded-[20px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
                  <div className="cf-kicker">Current Path</div>
                  <div className="mt-2 font-mono text-sm text-[var(--cf-text-1)]">{path}</div>
                </div>
              </div>

              {showingPublicKey && publicKey && (
                <div className="mt-4 max-w-2xl rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.06)] p-4">
                  <div className="flex items-center justify-between">
                    <div className="cf-kicker text-[10px] text-[var(--cf-blue)] uppercase">Public Key (authorized_keys)</div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(publicKey)
                          actions.notify({ kind: 'success', title: 'Copied', message: 'Public key copied to clipboard' })
                        } catch (err) {
                          actions.notify({ kind: 'error', title: 'Copy failed', message: 'Could not copy to clipboard' })
                        }
                      }}
                      className="text-[10px] font-bold text-[var(--cf-blue)] uppercase hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-2 break-all font-mono text-[11px] leading-relaxed text-[var(--cf-text-0)]">
                    {publicKey}
                  </div>
                </div>
              )}
            </div>
            <div className="cf-subpanel rounded-[28px] p-4 sm:p-5">
              <div className="cf-kicker">Guardrails</div>
              <div className="mt-4 space-y-3">
                <div className="rounded-[20px] border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] p-4 text-sm text-[var(--cf-text-1)]">
                  Manual VPS auth is preserved. Keep QA work inside <code>{MOCK_RUN_PATH}</code>.
                </div>
                <div className="rounded-[20px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4 text-sm text-[var(--cf-text-1)]">
                  Open <code>Mock Run</code> first, stay inside that tree, and retry from the same path instead of `/` if a root-level action is flaky.
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-[var(--cf-border)] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="cf-toolbar-card flex flex-wrap items-center gap-2 rounded-[20px] px-2 py-2">
                <span className="cf-micro-label px-2">Navigation</span>
                <button
                  type="button"
                  disabled={!canGoUp}
                  onClick={() => void load(parentPath(path))}
                  className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)] disabled:opacity-50"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => void load(MOCK_RUN_PATH)}
                  className="rounded-xl border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.08)] px-3 py-2 text-sm font-medium text-[var(--cf-blue)]"
                >
                  Mock Run
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/providers')}
                  className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)]"
                >
                  Back to Providers
                </button>
              </div>
              <div className="cf-toolbar-card flex flex-wrap items-center gap-2 rounded-[20px] px-2 py-2">
                <span className="cf-micro-label px-2">Create</span>
                <label htmlFor="vps-file-upload" className="sr-only">Upload file</label>
                <input
                  id="vps-file-upload"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="max-w-[220px] text-sm text-[var(--cf-text-1)]"
                />
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={() => void handleUpload()}
                  className="rounded-xl border border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.08)] px-3 py-2 text-sm font-medium text-[var(--cf-teal)] disabled:opacity-50"
                >
                  Upload
                </button>
                <label htmlFor="vps-new-folder" className="sr-only">New folder name</label>
                <input
                  id="vps-new-folder"
                  value={mkdirName}
                  onChange={(e) => setMkdirName(e.target.value)}
                  placeholder="New folder"
                  className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-3 py-2 text-sm text-[var(--cf-text-0)]"
                />
                <button
                  type="button"
                  onClick={() => void handleMkdir()}
                  className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)]"
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 sm:px-6 sm:py-5">
            {error && (
              <div className="mb-4 rounded-[20px] border border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">
                {error}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                <div className="cf-kicker">Visible Items</div>
                <div className="mt-3 font-mono text-[26px] font-bold text-[var(--cf-blue)]">{items.length}</div>
                <div className="mt-2 text-sm text-[var(--cf-text-2)]">Current folder rows returned by the saved VPS connection.</div>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                <div className="cf-kicker">Directory State</div>
                <div className="mt-3 text-sm font-semibold text-[var(--cf-text-0)]">{loading ? 'Loading' : items.length === 0 ? 'Empty' : 'Ready'}</div>
                <div className="mt-2 text-sm text-[var(--cf-text-2)]">Use mock paths only for QA file changes.</div>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                <div className="cf-kicker">Current Path</div>
                <div className="mt-3 truncate font-mono text-sm text-[var(--cf-text-0)]">{path}</div>
                <div className="mt-2 text-sm text-[var(--cf-text-2)]">Displayed after each browse, upload, mkdir, or delete action.</div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[26px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--cf-border)] bg-[var(--cf-table-head-bg)] text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-2)]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Modified</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cf-divider-soft)]">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8" colSpan={5}>
                        <div className="flex items-center justify-center gap-3 text-[var(--cf-text-2)]">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cf-blue)]/25 border-t-[var(--cf-blue)]" />
                          <span>Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10" colSpan={5}>
                        <div className="mx-auto max-w-md rounded-[20px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-5 text-center">
                          <div className="cf-kicker mb-2">Directory</div>
                          <div className="text-sm font-semibold text-[var(--cf-text-0)]">Empty directory</div>
                          <div className="mt-1 text-sm text-[var(--cf-text-2)]">Upload a file or create a folder inside the current mock-path scope.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const remotePath = joinPath(path, item.name)
                      return (
                        <tr key={`${item.type}:${item.name}`} data-testid={`cf-vps-row-${item.name}`} className="hover:bg-[rgba(255,255,255,0.03)]">
                          <td className="px-4 py-3">
                            {item.type === 'dir' ? (
                              <button
                                type="button"
                                onClick={() => void load(remotePath)}
                                className="rounded-lg px-1 py-1 text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.08)]"
                              >
                                {item.name}
                              </button>
                            ) : (
                              <span className="text-[var(--cf-text-1)]">{item.name}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] text-[var(--cf-text-2)]">
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--cf-text-1)]">{item.type === 'dir' ? '--' : formatBytes(item.size)}</td>
                          <td className="px-4 py-3 text-[var(--cf-text-2)]">{formatVpsDate(item.modifiedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {item.type === 'file' && (
                                <a
                                  href={`/api/providers/vps/${id}/files/download?path=${encodeURIComponent(remotePath)}`}
                                  className="rounded-xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] px-3 py-1.5 text-sm font-medium text-[var(--cf-blue)]"
                                >
                                  Download
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                className="rounded-xl border border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] px-3 py-1.5 text-sm font-medium text-[var(--cf-red)]"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
