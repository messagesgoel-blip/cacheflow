'use client'

import { useState, useEffect } from 'react'
import { createShareLink } from '@/lib/api'

interface ShareDialogProps {
  fileId: string
  filename: string
  token: string
  onClose: () => void
  onShareCreated: (url: string) => void
}

export default function ShareDialog({ fileId, filename, token, onClose, onShareCreated }: ShareDialogProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Auto-create share link on mount
    createShareLink(fileId, token)
      .then((data: any) => {
        const url = `${window.location.origin}/share/${data.share_link?.token || data.token}`
        setShareUrl(url)
        // Auto-copy to clipboard
        navigator.clipboard.writeText(url)
        setCopied(true)
        onShareCreated(url)
      })
      .catch((err: any) => {
        console.error('Share error:', err)
        setError(err.message || 'Failed to create share link')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [fileId, token])

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-white">Share "{filename}"</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">&times;</button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Creating share link...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-red-500 dark:text-red-400">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-sm"
              >
                Close
              </button>
            </div>
          ) : shareUrl ? (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Share link (auto-copied!)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-sm bg-gray-50"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded text-sm text-white ${
                      copied ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Anyone with this link can view the file
              </p>
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

