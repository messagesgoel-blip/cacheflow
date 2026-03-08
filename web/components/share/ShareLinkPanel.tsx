'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileMetadata } from '@/lib/providers/types'
import { apiCreateShareLink } from '@/lib/api'
import { ShareLinkList } from './ShareLinkList'

interface ShareLinkPanelProps {
  file: FileMetadata
  token: string
  onClose: () => void
  userHas2FA?: boolean
}

export interface ShareLink {
  id: string
  token: string
  url: string
  createdAt: string
  expiresAt?: string
  passwordRequired: boolean
  maxDownloads?: number
  downloadCount?: number
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

export function ShareLinkPanel({ file, token, onClose, userHas2FA = false }: ShareLinkPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needs2FA, setNeeds2FA] = useState(false)
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Form state
  const [password, setPassword] = useState('')
  const [expiryHours, setExpiryHours] = useState<number | ''>('')

  // Fetch existing share links for this file
  const fetchShareLinks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/files/${file.id}/shares`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setShareLinks(data.shares || [])
      }
    } catch (err) {
      console.error('Failed to fetch share links:', err)
    }
  }, [file.id, token])

  useEffect(() => {
    fetchShareLinks()
  }, [fetchShareLinks])

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNeeds2FA(false)

    try {
      const options: { password?: string, expiryHours?: number } = {}
      if (password) options.password = password
      if (expiryHours) options.expiryHours = Number(expiryHours)

      const data = await apiCreateShareLink(file.id, token, options)

      const newLink: ShareLink = {
        id: data.id || data.shareId,
        token: data.token,
        url: `${window.location.origin}/s/${data.token}`,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt,
        passwordRequired: data.passwordRequired || !!password,
        maxDownloads: data.maxDownloads,
        downloadCount: 0
      }

      setShareLinks(prev => [newLink, ...prev])
      setShowCreateForm(false)
      setPassword('')
      setExpiryHours('')

      // Auto-copy to clipboard
      navigator.clipboard.writeText(newLink.url)
      setCopied(newLink.token)
      setTimeout(() => setCopied(null), 2000)
    } catch (err: any) {
      // Check for 403 - 2FA not enabled
      if (err.message?.includes('403') || err.message?.includes('2FA') || err.message?.includes('two-factor')) {
        setNeeds2FA(true)
        setError('Two-factor authentication is required to create share links')
      } else {
        setError(err.message || 'Failed to create share link')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeShareLink = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share link?')) return

    try {
      const res = await fetch(`${API}/share/${shareId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        throw new Error('Failed to revoke share link')
      }

      setShareLinks(prev => prev.filter(link => link.id !== shareId))
    } catch (err: any) {
      setError(err.message || 'Failed to revoke share link')
    }
  }

  const handleCopyLink = (shareLink: ShareLink) => {
    navigator.clipboard.writeText(shareLink.url)
    setCopied(shareLink.token)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const formatExpiry = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))

    if (diffHours < 0) return 'Expired'
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
    const diffDays = Math.round(diffHours / 24)
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
    return date.toLocaleDateString()
  }

  // If user needs 2FA, show the 2FA setup prompt
  if (needs2FA) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Two-Factor Authentication Required
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                To create share links, you must enable two-factor authentication on your account.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href="/settings?tab=security"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Enable 2FA in Settings
              </a>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">Share "{file.name}"</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Create and manage share links</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Existing Share Links */}
          {shareLinks.length > 0 && !showCreateForm && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Active Share Links
              </h4>
              <ShareLinkList
                links={shareLinks}
                onCopy={handleCopyLink}
                onRevoke={handleRevokeShareLink}
                copied={copied}
                formatExpiry={formatExpiry}
              />
            </div>
          )}

          {/* Create Form */}
          {showCreateForm ? (
            <form onSubmit={handleCreateShareLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password Protection (optional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to protect link"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank for public link</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link Expiration (optional)
                </label>
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                >
                  <option value="">Never expires</option>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Share Link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShareLinkPanel

