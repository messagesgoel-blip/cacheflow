'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useActionCenter } from '@/components/ActionCenterProvider'

interface VpsItem {
  name: string
  type: 'file' | 'dir'
  size: number
  modifiedAt?: string | null
}

const MOCK_RUN_PATH = '/srv/storage/local/mock run'

function normalizePath(raw: string): string {
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function joinPath(base: string, name: string): string {
  if (base === '/') return `/${name}`
  return `${base.replace(/\/+$/, '')}/${name}`
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
  const latestLoadId = useRef(0)

  const canGoUp = useMemo(() => path !== '/', [path])

  const load = useCallback(async (targetPath: string) => {
    if (!id) return
    const requestId = ++latestLoadId.current
    setLoading(true)
    setError(null)
    const normalized = normalizePath(targetPath)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar email="Account" onLogout={() => router.push('/login')} />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">VPS File Browser</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Connection ID: {id}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Path: {path}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/providers')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Back to Providers
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-100">
          <p>
            Manual VPS auth is preserved. Keep QA work inside <code>{MOCK_RUN_PATH}</code> so browse, upload, copy, move, preview, and delete checks stay isolated from real server content.
          </p>
          <p className="mt-2 text-xs text-blue-800 dark:text-blue-200">
            Manual flow: open <code>Mock Run</code> first, stay inside that tree, and if root-level transfer checks fail retry from the same path instead of <code>/</code>.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            disabled={!canGoUp}
            onClick={() => void load(parentPath(path))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            Up
          </button>
          <button
            type="button"
            onClick={() => void load(MOCK_RUN_PATH)}
            className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30"
          >
            Mock Run
          </button>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          <button
            type="button"
            disabled={!selectedFile}
            onClick={() => void handleUpload()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Upload
          </button>
          <input
            value={mkdirName}
            onChange={(e) => setMkdirName(e.target.value)}
            placeholder="New folder"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={() => void handleMkdir()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
          >
            Create Folder
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Modified</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400" colSpan={5}>
                    Empty directory
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const remotePath = joinPath(path, item.name)
                  return (
                    <tr key={`${item.type}:${item.name}`} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2">
                        {item.type === 'dir' ? (
                          <button
                            type="button"
                            onClick={() => void load(remotePath)}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {item.name}
                          </button>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-3 py-2">{item.type}</td>
                      <td className="px-3 py-2">{item.size}</td>
                      <td className="px-3 py-2">{item.modifiedAt || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {item.type === 'file' && (
                            <a
                              href={`/api/providers/vps/${id}/files/download?path=${encodeURIComponent(remotePath)}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Download
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            className="text-red-600 hover:underline dark:text-red-400"
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
      </main>
    </div>
  )
}
