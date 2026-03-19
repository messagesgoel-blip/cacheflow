'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TransferChart from '@/components/TransferChart'
import StorageChart from '@/components/StorageChart'
import { useClientSession } from '@/lib/auth/clientSession'
import { formatFileSize } from '@/lib/utils/format'

interface AdminStats {
  total_users?: number
  total_files?: number
  storage_used_bytes?: number
  daily_transfer_bytes?: number
}

export default function AdminPage() {
  const { authenticated, email, loading: sessionLoading } = useClientSession({ redirectTo: '/login?reason=session_expired' })
  const [stats, setStats] = useState<AdminStats>({})
  const [loading, setLoading] = useState(true)
  const [apiAvailable, setApiAvailable] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [showAdminBanner, setShowAdminBanner] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('admin_banner_dismissed')
    }
    return true
  })

  useEffect(() => {
    if (authenticated) {
      void fetchStats()
    }
  }, [authenticated])

  async function fetchStats() {
    setLoading(true)

    try {
      const res = await fetch('/api/backend/admin/stats', {
        credentials: 'include',
      })

      if (res.status === 404) {
        setApiAvailable(false)
        setStats({})
        return
      }

      if (res.status === 403) {
        setForbidden(true)
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.status}`)
      }

      const data = await res.json()
      setStats(data)
      setApiAvailable(true)
    } catch (err: any) {
      // Avoid noisy console stack traces during QA; surface via UI state
      setApiAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  if (forbidden) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Access Denied</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">You do not have administrative privileges.</p>
          <Link href="/" className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">Return to Home</Link>
        </div>
      </div>
    )
  }

  if (sessionLoading || !authenticated) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">System overview and statistics</p>
        </div>

        {!apiAvailable && showAdminBanner && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                <span className="text-yellow-700 dark:text-yellow-300">Admin API coming soon. Showing placeholder data.</span>
              </div>
              <button 
                onClick={() => {
                  setShowAdminBanner(false)
                  sessionStorage.setItem('admin_banner_dismissed', '1')
                }}
                className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">Total Users</h3>
              <div className="text-blue-500">👥</div>
            </div>
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {loading ? '...' : (stats.total_users ? stats.total_users : 'N/A')}
            </div>
            {stats.total_users ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Registered accounts</p>
            ) : (
              <p className="text-xs bg-blue-900/40 text-blue-400 rounded px-2 py-0.5 mt-1 inline-block">API coming soon</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">Total Files</h3>
              <div className="text-green-500">📄</div>
            </div>
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {loading ? '...' : (stats.total_files ? stats.total_files : 'N/A')}
            </div>
            {stats.total_files ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Files stored</p>
            ) : (
              <p className="text-xs bg-blue-900/40 text-blue-400 rounded px-2 py-0.5 mt-1 inline-block">API coming soon</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">Storage Used</h3>
              <div className="text-purple-500">💾</div>
            </div>
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {loading ? '...' : (stats.storage_used_bytes ? formatFileSize(stats.storage_used_bytes) : 'N/A')}
            </div>
            {stats.storage_used_bytes ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Total storage consumed</p>
            ) : (
              <p className="text-xs bg-blue-900/40 text-blue-400 rounded px-2 py-0.5 mt-1 inline-block">API coming soon</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">Daily Transfer</h3>
              <div className="text-orange-500">📤</div>
            </div>
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {loading ? '...' : (stats.daily_transfer_bytes ? formatFileSize(stats.daily_transfer_bytes) : 'N/A')}
            </div>
            {stats.daily_transfer_bytes ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Today's data transfer</p>
            ) : (
              <p className="text-xs bg-blue-900/40 text-blue-400 rounded px-2 py-0.5 mt-1 inline-block">API coming soon</p>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <TransferChart />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <StorageChart />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Activity</h2>
            <a href="/admin/audit" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all →
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-4">Timestamp</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2">Resource</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 pr-4">2026-02-23 14:30</td>
                  <td className="py-3 pr-4">user@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">Upload</span></td>
                  <td className="py-3">report.pdf</td>
                </tr>
                <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 pr-4">2026-02-23 13:15</td>
                  <td className="py-3 pr-4">admin@cacheflow.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">Login</span></td>
                  <td className="py-3">—</td>
                </tr>
                <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 pr-4">2026-02-23 12:45</td>
                  <td className="py-3 pr-4">user2@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">Share</span></td>
                  <td className="py-3">presentation.pptx</td>
                </tr>
                <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 pr-4">2026-02-23 11:20</td>
                  <td className="py-3 pr-4">user@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">Delete</span></td>
                  <td className="py-3">old-doc.txt</td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 pr-4">2026-02-23 10:05</td>
                  <td className="py-3 pr-4">user3@example.com</td>
                  <td className="py-3 pr-4"><span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs">Rename</span></td>
                  <td className="py-3">document-v2.docx</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/admin/users" className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="text-blue-500 text-xl">👥</div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">User Management</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage users and quotas</p>
              </div>
            </div>
          </a>
          <a href="/admin/audit" className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="text-green-500 text-xl">📊</div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Audit Log</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">View system activity</p>
              </div>
            </div>
          </a>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div className="flex items-center gap-3">
              <div className="text-gray-400 text-xl">⚙️</div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">System Settings</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
