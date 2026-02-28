'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SessionHandler() {
  const router = useRouter()
  const [showBanner, setShowBanner] = useState(false)
  const [bannerMessage, setBannerMessage] = useState('')

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (reason?.message === 'SESSION_EXPIRED') {
        event.preventDefault()
        setBannerMessage('Session expired. Please reconnect your provider.')
        setShowBanner(true)
      }
    }

    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (!showBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-yellow-900/90 text-yellow-100 border-b border-yellow-700 flex items-center justify-between">
      <span>{bannerMessage}</span>
      <div className="flex gap-2">
        <button
          onClick={() => router.push('/cloud-drives')}
          className="px-3 py-1 text-sm bg-yellow-700 hover:bg-yellow-600 rounded"
        >
          Reconnect
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
