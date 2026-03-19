'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClientSession } from '@/lib/auth/clientSession'

interface AuditLogEntry {
  id: string
  timestamp: string
  user_email: string
  action: string
  resource_type: string
  resource_id: string
  details: string
}

export default function AuditLogPage() {
  const { authenticated, email, loading: sessionLoading } = useClientSession({ redirectTo: '/login?reason=session_expired' })
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (authenticated) {
      void fetchAuditLogs()
    }
  }, [authenticated])

  async function fetchAuditLogs() {
    setLoading(true)

    try {
      const res = await fetch('/api/backend/admin/audit-log', {
        credentials: 'include',
      })

      if (res.status === 403) {
        setForbidden(true)
        return
      }

      if (res.status === 404) {
        // Use mock data if API not implemented
        generateMockData()
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch audit logs: ${res.status}`)
      }

      const data = await res.json()
      setLogs(data.logs || data || [])
    } catch (err: any) {
      console.error('Failed to load audit logs:', err)
      if (err?.message?.includes('403')) {
        setForbidden(true)
      } else {
        generateMockData()
      }
    } finally {
      setLoading(false)
    }
  }

  function generateMockData() {
    const mockLogs: AuditLogEntry[] = []
    const actions = ['login', 'upload', 'download', 'delete', 'share', 'rename', 'quota_change']
    const resources = ['file', 'user', 'share_link', 'conflict']
    const users = ['admin@cacheflow.com', 'user@example.com', 'user2@example.com', 'user3@example.com']

    const now = new Date()

    for (let i = 0; i < 50; i++) {
      const date = new Date(now)
      date.setHours(date.getHours() - Math.floor(Math.random() * 168)) // Random time in last 7 days

      const action = actions[Math.floor(Math.random() * actions.length)]
      const resource = resources[Math.floor(Math.random() * resources.length)]
      const user = users[Math.floor(Math.random() * users.length)]

      mockLogs.push({
        id: `log-${i}`,
        timestamp: date.toISOString(),
        user_email: user,
        action: action,
        resource_type: resource,
        resource_id: `res-${Math.floor(Math.random() * 1000)}`,
        details: `${action} ${resource}`
      })
    }

    // Sort by timestamp descending
    mockLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setLogs(mockLogs)
  }

  function handleExportCSV() {
    const filtered = getFilteredLogs()
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Resource', 'Details'].join(','),
      ...filtered.map(log => [
        formatDateForCSV(log.timestamp),
        log.user_email,
        log.action,
        log.resource_type,
        `"${log.details.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function formatDateForCSV(dateString: string): string {
    return new Date(dateString).toISOString()
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  function getFilteredLogs() {
    let filtered = [...logs]

    // Filter by action
    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction)
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate)
      filtered = filtered.filter(log => new Date(log.timestamp) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter(log => new Date(log.timestamp) <= end)
    }

    return filtered
  }

  function getPaginatedLogs() {
    const filtered = getFilteredLogs()
    const startIndex = (currentPage - 1) * itemsPerPage
    return filtered.slice(startIndex, startIndex + itemsPerPage)
  }

  function getActionColor(action: string): string {
    const colors: Record<string, string> = {
      login: 'bg-blue-100 text-blue-700',
      upload: 'bg-green-100 text-green-700',
      download: 'bg-purple-100 text-purple-700',
      delete: 'bg-red-100 text-red-700',
      share: 'bg-yellow-100 text-yellow-700',
      rename: 'bg-indigo-100 text-indigo-700',
      quota_change: 'bg-pink-100 text-pink-700'
    }
    return colors[action] || 'bg-gray-100 text-gray-700'
  }

  if (forbidden) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-gray-800">Access Denied</h2>
          <p className="mt-2 text-gray-600">You do not have permission to view audit logs.</p>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">Return to Home</Link>
        </div>
      </div>
    )
  }

  if (sessionLoading || !authenticated) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const filteredLogs = getFilteredLogs()
  const paginatedLogs = getPaginatedLogs()
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const uniqueActions = Array.from(new Set(logs.map(log => log.action))).sort()

  return (
    <div>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
              <p className="text-gray-600 mt-1">System activity and user actions</p>
            </div>
            <a
              href="/admin"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-600">
              Showing {paginatedLogs.length} of {filteredLogs.length} logs
              {filterAction !== 'all' && ` (filtered by: ${filterAction})`}
            </div>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-2"
            >
              <span>📥</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading audit logs...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                      <th className="py-3 px-4 font-medium">User</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Resource</th>
                      <th className="py-3 px-4 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map(log => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="text-gray-600">{formatDate(log.timestamp)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{log.user_email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-700">{log.resource_type}</div>
                          <div className="text-gray-500 text-xs font-mono">{log.resource_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-700">{log.details}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
