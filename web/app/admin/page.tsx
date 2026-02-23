'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TransferChart from '@/components/TransferChart'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

interface AdminStats {
  total_users?: number
  total_files?: number
  storage_used_bytes?: number
  daily_transfer_bytes?: number
}

export default function AdminPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [stats, setStats] = useState<AdminStats>({})
  const [loading, setLoading] = useState(true)
  const [apiAvailable, setApiAvailable] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')

    if (!t) {
      router.push('/')
      return
    }

    setToken(t)
    setEmail(e || '')
  }, [router])

  useEffect(() => {
    if (token) {
      fetchStats()
    }
  }, [token])

  async function fetchStats() {
    setLoading(true)

    try {
      const res = await fetch(`${API}/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status === 404) {
        setApiAvailable(false)
        setStats({})
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.status}`)
      }

      const data = await res.json()
      setStats(data)
      setApiAvailable(true)
    } catch (err: any) {
      console.error('Failed to load admin stats:', err)
      setApiAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  function formatBytes(bytes: number | undefined): string {
    if (!bytes) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  function formatGB(bytes: number | undefined): string {
    if (!bytes) return '—'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  function handleLogout() {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    router.push('/')
  }

  if (!token) {
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
          <button onClick={handleLogout} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">System overview and statistics</p>
        </div>

        {!apiAvailable && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">⚠</span>
              <span className="text-yellow-700">Admin API coming soon. Showing placeholder data.</span>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Total Users</h3>
              <div className="text-blue-500">👥</div>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {loading ? '...' : (stats.total_users || '—')}
            </div>
            <p className="text-gray-500 text-sm mt-1">Registered accounts</p>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Total Files</h3>
              <div className="text-green-500">📄</div>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {loading ? '...' : (stats.total_files || '—')}
            </div>
            <p className="text-gray-500 text-sm mt-1">Files stored</p>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Storage Used</h3>
              <div className="text-purple-500">💾</div>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {loading ? '...' : formatGB(stats.storage_used_bytes)}
            </div>
            <p className="text-gray-500 text-sm mt-1">Total storage consumed</p>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Daily Transfer</h3>
              <div className="text-orange-500">📤</div>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {loading ? '...' : formatGB(stats.daily_transfer_bytes)}
            </div>
            <p className="text-gray-500 text-sm mt-1">Today's data transfer</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <TransferChart token={token!} />
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p>Storage chart coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
            <a href="/admin/audit" className="text-sm text-blue-600 hover:underline">
              View all →
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Timestamp</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2">Resource</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4">2026-02-23 14:30</td>
                  <td className="py-3 pr-4">user@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Upload</span></td>
                  <td className="py-3">report.pdf</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4">2026-02-23 13:15</td>
                  <td className="py-3 pr-4">admin@cacheflow.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Login</span></td>
                  <td className="py-3">—</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4">2026-02-23 12:45</td>
                  <td className="py-3 pr-4">user2@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">Share</span></td>
                  <td className="py-3">presentation.pptx</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4">2026-02-23 11:20</td>
                  <td className="py-3 pr-4">user@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Delete</span></td>
                  <td className="py-3">old-doc.txt</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="py-3 pr-4">2026-02-23 10:05</td>
                  <td className="py-3 pr-4">user3@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Rename</span></td>
                  <td className="py-3">document-v2.docx</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/admin/users" className="bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="text-blue-500 text-xl">👥</div>
              <div>
                <h3 className="font-semibold text-gray-800">User Management</h3>
                <p className="text-gray-500 text-sm mt-1">Manage users and quotas</p>
              </div>
            </div>
          </a>
          <a href="/admin/audit" className="bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="text-green-500 text-xl">📊</div>
              <div>
                <h3 className="font-semibold text-gray-800">Audit Log</h3>
                <p className="text-gray-500 text-sm mt-1">View system activity</p>
              </div>
            </div>
          </a>
          <div className="bg-gray-50 rounded-xl shadow p-5">
            <div className="flex items-center gap-3">
              <div className="text-gray-400 text-xl">⚙️</div>
              <div>
                <h3 className="font-semibold text-gray-800">System Settings</h3>
                <p className="text-gray-500 text-sm mt-1">Coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}