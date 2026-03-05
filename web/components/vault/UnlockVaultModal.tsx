'use client'

import { useState, useEffect } from 'react'

interface UnlockVaultModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: (pin: string) => Promise<boolean>
}

const DISCLAIMER_TEXT = 'Private Folder hides files from All Files and search, but does not provide encryption. Your files remain accessible to anyone with provider access.'

export default function UnlockVaultModal({ isOpen, onClose, onUnlock }: UnlockVaultModalProps) {
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPin('')
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setError('Please enter your PIN')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await onUnlock(pin)
      if (success) {
        onClose()
      } else {
        setError('Invalid PIN. Please try again.')
      }
    } catch (err) {
      setError('Failed to unlock. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close"
        >
          <span className="text-gray-500 text-xl">✕</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Unlock Private Folder
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your PIN to access your private files
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex gap-2">
            <span className="text-amber-600 dark:text-amber-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {DISCLAIMER_TEXT}
            </p>
          </div>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="vault-pin"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              PIN
            </label>
            <input
              id="vault-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your 6-digit PIN"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              maxLength={6}
              autoFocus
              disabled={isLoading}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
