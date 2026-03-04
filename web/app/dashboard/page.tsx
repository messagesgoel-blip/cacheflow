'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import StorageHero from '@/components/dashboard/StorageHero'
import { tokenManager } from '@/lib/tokenManager'
import { ProviderId } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import apiClient from '@/lib/apiClient'

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [connectedProviders, setConnectedProviders] = useState<Array<{
    providerId: string
    accountEmail: string
    displayName: string
    quota?: { used: number; total: number }
  }>>([])

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (t && e) {
      setToken(t)
      setEmail(e)
    }
  }, [])

  useEffect(() => {
    if (!token) return

    const loadConnections = async () => {
      // Get local tokens
      const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'vps', 'webdav', 'local']
      const connected: typeof connectedProviders = []

      for (const pid of providerIds) {
        const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
        tokens.forEach((t) => {
          if (t && (t.accessToken || (t as any).remoteId)) {
            connected.push({
              providerId: pid,
              accountEmail: t.accountEmail || '',
              displayName: t.displayName || pid,
              quota: (t as any).quota
            })
          }
        })
      }

      // Try to get server connections for quota
      try {
        const result = await apiClient.getConnections()
        if (result.success && result.data) {
          for (const conn of result.data) {
            const existing = connected.find(c => c.providerId === conn.provider)
            if (existing && conn.accountEmail === existing.accountEmail) {
              // Update with server quota if available
              // For now, just use local
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch server connections:', err)
      }

      setConnectedProviders(connected)
    }

    loadConnections()
  }, [token])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to view your dashboard</p>
          <a href="/login" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Log In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar email={email} onLogout={() => {
        localStorage.removeItem('cf_token')
        localStorage.removeItem('cf_email')
        window.location.href = '/login'
      }} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

        {/* Storage Hero - SCHED-1: Storage pooling dashboard with aggregate hero */}
        <div className="mb-8">
          <StorageHero connectedProviders={connectedProviders} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Connected Providers</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{connectedProviders.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Activity</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">-</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Pending Transfers</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">-</p>
          </div>
        </div>
      </div>
    </div>
  )
}
