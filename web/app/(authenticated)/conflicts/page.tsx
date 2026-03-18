'use client'

import ConflictList from '@/components/ConflictList'
import { logoutClientSession, useClientSession } from '@/lib/auth/clientSession'

export default function ConflictsPage() {
  const { authenticated, email, loading } = useClientSession({ redirectTo: '/login?reason=session_expired' })

  if (loading || !authenticated) {
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
      

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Conflict Resolution</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Resolve conflicts between local and cloud versions of your files</p>
            </div>
            <a
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Files
            </a>
          </div>

          <ConflictList />
        </div>
      </main>
    </div>
  )
}
