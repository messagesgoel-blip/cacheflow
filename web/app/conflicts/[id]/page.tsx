'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import ConflictViewer from '@/components/ConflictViewer'
import { resolveConflict } from '@/lib/api'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { logoutClientSession, useClientSession } from '@/lib/auth/clientSession'

interface Conflict {
  id: string
  filename: string
  detected_at: string
  status: 'unresolved' | 'resolved'
  local_version?: {
    path: string
    size_bytes: number
    modified_at: string
  }
  cloud_version?: {
    path: string
    size_bytes: number
    modified_at: string
  }
}

export default function ConflictDetailPage() {
  const params = useParams()
  const conflictId = params.id as string

  const { authenticated, email, loading: sessionLoading } = useClientSession({ redirectTo: '/login?reason=session_expired' })
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)
  const actions = useActionCenter()

  useEffect(() => {
    if (authenticated) {
      fetchConflict()
    }
  }, [authenticated, conflictId])

  async function fetchConflict() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/backend/conflicts/${conflictId}`, {
        credentials: 'include',
      })

      if (res.status === 404) {
        setError('Conflict not found')
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch conflict: ${res.status}`)
      }

      const data = await res.json()
      setConflict(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load conflict')
    } finally {
      setLoading(false)
    }
  }

  async function handleResolve(resolution: 'keep_local' | 'keep_remote') {
    if (!conflict) return

    setResolving(resolution)
    setError(null)

    try {
      const task = actions.startTask({ title: 'Resolving conflict', message: resolution, progress: null })
      await resolveConflict(conflict.id, resolution, '')

      // Update conflict status
      setConflict({
        ...conflict,
        status: 'resolved'
      })
      task.succeed('Resolved')
    } catch (err: any) {
      setError(err.message || 'Failed to resolve conflict')
      actions.notify({ kind: 'error', title: 'Resolve failed', message: err.message })
    } finally {
      setResolving(null)
    }
  }

  if (sessionLoading || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
          <div className="flex items-center gap-6">
            <span className="font-bold text-lg tracking-tight">CacheFlow</span>
            <div className="flex gap-4">
              <a href="/" className="text-blue-200 hover:text-white text-sm">Files</a>
              <a href="/conflicts" className="text-white font-medium text-sm">Conflicts</a>
              <a href="/admin" className="text-blue-200 hover:text-white text-sm">Admin</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-200 text-sm">{email}</span>
            <button onClick={() => { void logoutClientSession('/login') }} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading conflict details...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !conflict) {
    return (
      <div className="min-h-screen">
        <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
          <div className="flex items-center gap-6">
            <span className="font-bold text-lg tracking-tight">CacheFlow</span>
            <div className="flex gap-4">
              <a href="/" className="text-blue-200 hover:text-white text-sm">Files</a>
              <a href="/conflicts" className="text-white font-medium text-sm">Conflicts</a>
              <a href="/admin" className="text-blue-200 hover:text-white text-sm">Admin</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-200 text-sm">{email}</span>
            <button onClick={() => { void logoutClientSession('/login') }} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-center py-8">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Error</h3>
              <p className="text-gray-600 mb-4">{error || 'Conflict not found'}</p>
              <a
                href="/conflicts"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                ← Back to Conflicts
              </a>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">CacheFlow</span>
          <div className="flex gap-4">
            <a href="/" className="text-blue-200 hover:text-white text-sm">Files</a>
            <a href="/conflicts" className="text-white font-medium text-sm">Conflicts</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-sm">{email}</span>
          <button onClick={() => { void logoutClientSession('/login') }} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Conflict Resolution</h1>
              <p className="text-gray-600 text-sm mt-1">Resolve differences between file versions</p>
            </div>
            <a
              href="/conflicts"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Conflicts
            </a>
          </div>

          <ConflictViewer
            conflict={conflict}
            onResolve={handleResolve}
            resolving={resolving}
          />
        </div>
      </main>
    </div>
  )
}
