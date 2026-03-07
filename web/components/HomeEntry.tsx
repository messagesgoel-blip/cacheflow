'use client'

import Login from '@/components/Login'

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
    <Login
      initialMode={initialMode}
      onLogin={(token, email) => {
        try {
          clearStaleProviderState()
          localStorage.setItem('cf_token', token)
          localStorage.setItem('cf_email', email)
        } catch (error) {
          console.warn('Failed to persist local session token:', error)
        }
        window.location.href = '/files'
      }}
    />
  )
}
