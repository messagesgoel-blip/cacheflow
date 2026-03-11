'use client'

import { useState, useEffect } from 'react'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { logoutClientSession, useClientSession } from '@/lib/auth/clientSession'

interface User {
  id: string
  email: string
  tenant_id: string
  quota_bytes: number
  used_bytes: number
  created_at: string
  status: 'active' | 'suspended'
}

export default function UserManagementPage() {
  const { authenticated, email, loading: sessionLoading } = useClientSession({ redirectTo: '/login?reason=session_expired' })
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingQuota, setEditingQuota] = useState<string | null>(null)
  const [newQuota, setNewQuota] = useState('')
  const [quotaLoading, setQuotaLoading] = useState<string | null>(null)
  const actions = useActionCenter()

  useEffect(() => {
    if (authenticated) {
      void fetchUsers()
    }
  }, [authenticated])

  async function fetchUsers() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/backend/admin/users', {
        credentials: 'include',
      })

      if (res.status === 404) {
        // API endpoint not implemented yet
        setUsers([])
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch users: ${res.status}`)
      }

      const data = await res.json()
      setUsers(data.users || data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdjustQuota(userId: string, currentQuotaGB: number) {
    if (!authenticated) return

    setQuotaLoading(userId)

    try {
      const quotaBytes = parseFloat(newQuota) * 1024 * 1024 * 1024

      const res = await fetch(`/api/backend/admin/users/${userId}/quota`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ quota_bytes: quotaBytes })
      })

      if (res.status === 404) {
        actions.notify({ kind: 'info', title: 'Coming soon', message: 'Quota adjustment coming soon' })
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to adjust quota: ${res.status}`)
      }

      // Update local state
      setUsers(users.map(user =>
        user.id === userId ? { ...user, quota_bytes: quotaBytes } : user
      ))

      setEditingQuota(null)
      setNewQuota('')
      actions.notify({ kind: 'success', title: 'Quota updated' })
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Error', message: err.message })
    } finally {
      setQuotaLoading(null)
    }
  }

  async function handleDeactivate(userId: string, userEmail: string) {
    const ok = await actions.confirm({
      title: 'Deactivate user?',
      message: `Deactivate user ${userEmail}?`,
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
    })
    if (!ok) return
    if (!authenticated) return

    try {
      const res = await fetch(`/api/backend/admin/users/${userId}/deactivate`, {
        method: 'POST',
        credentials: 'include',
      })

      if (res.status === 404) {
        actions.notify({ kind: 'info', title: 'Coming soon', message: 'User management coming soon' })
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to deactivate user: ${res.status}`)
      }

      // Update local state
      setUsers(users.map(user =>
        user.id === userId ? { ...user, status: 'suspended' } : user
      ))

      actions.notify({ kind: 'success', title: 'User deactivated', message: userEmail })
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Error', message: err.message })
    }
  }

  function formatBytesToGB(bytes: number): string {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">CacheFlow</span>
          <div className="flex gap-4">
            <a href="/" className="text-blue-200 hover:text-white text-sm">Files</a>
            <a href="/conflicts" className="text-blue-200 hover:text-white text-sm">Conflicts</a>
            <a href="/admin" className="text-white font-medium text-sm">Admin</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-sm">{email}</span>
          <button onClick={() => { void logoutClientSession('/login') }} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
              <p className="text-gray-600 mt-1">Manage user accounts and storage quotas</p>
            </div>
            <a
              href="/admin"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error: {error}</p>
            <button
              onClick={fetchUsers}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div className="text-gray-400 text-4xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No user data available</h3>
            <p className="text-gray-500">The user management API is not yet implemented.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500">
                    <th className="py-3 px-4 font-medium">Email</th>
                    <th className="py-3 px-4 font-medium">Tenant</th>
                    <th className="py-3 px-4 font-medium">Quota (GB)</th>
                    <th className="py-3 px-4 font-medium">Used (GB)</th>
                    <th className="py-3 px-4 font-medium">Created At</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{user.email}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                        {user.tenant_id}
                      </td>
                      <td className="py-3 px-4">
                        {editingQuota === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={newQuota}
                              onChange={(e) => setNewQuota(e.target.value)}
                              className="w-20 px-2 py-1 border rounded text-sm"
                              placeholder={formatBytesToGB(user.quota_bytes)}
                              autoFocus
                            />
                            <span className="text-gray-500 text-sm">GB</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleAdjustQuota(user.id, parseFloat(formatBytesToGB(user.quota_bytes)))}
                                disabled={quotaLoading === user.id}
                                className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100 disabled:opacity-50"
                              >
                                {quotaLoading === user.id ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingQuota(null)
                                  setNewQuota('')
                                }}
                                className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatBytesToGB(user.quota_bytes)} GB</span>
                            <button
                              onClick={() => {
                                setEditingQuota(user.id)
                                setNewQuota(formatBytesToGB(user.quota_bytes))
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Adjust
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{formatBytesToGB(user.used_bytes)} GB</div>
                        <div className="text-xs text-gray-500">
                          {((user.used_bytes / user.quota_bytes) * 100).toFixed(1)}% used
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeactivate(user.id, user.email)}
                          className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
