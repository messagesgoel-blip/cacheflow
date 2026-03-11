'use client'

import Login from '@/components/Login'
import { clearLegacyAuthState } from '@/lib/auth/clientSession'

function clearStaleProviderState() {
  const keysToRemove: string[] = []
  for (const key of Object.keys(localStorage)) {
    if (
      key.startsWith('cacheflow_tokens_') ||
      key.startsWith('cacheflow_token_') ||
      key === 'cacheflow_vps_config' ||
      key === 'cacheflow_webdav_config'
    ) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

export default function HomeEntry({
  initialMode = 'login',
}: {
  initialMode?: 'login' | 'register'
}) {
  return (
    <div className="cf-shell-page flex min-h-screen w-full items-center justify-center">
      <Login
        initialMode={initialMode}
        onLogin={(token, email) => {
          try {
            clearStaleProviderState()
            clearLegacyAuthState()
          } catch (error) {
            console.warn('Failed to clear legacy local auth state:', error)
          }
          window.location.href = '/files'
        }}
      />
    </div>
  )
}
