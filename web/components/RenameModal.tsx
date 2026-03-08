'use client'

import { useEffect, useRef, useState } from 'react'

export default function RenameModal({
  isOpen,
  title,
  initialValue,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  title: string
  initialValue: string
  onClose: () => void
  onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false)
      setError(null)
      return
    }
    setValue(initialValue)
    setError(null)
    setIsSubmitting(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen, initialValue])

  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleGlobalEsc)
    return () => window.removeEventListener('keydown', handleGlobalEsc)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!value.trim()) {
      setError('Name is required')
      return
    }
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)

    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), 15000))
      await Promise.race([onSubmit(value.trim()), timeoutPromise])
      // Success is handled by the parent unmounting us
    } catch (err: any) {
      setError(err?.message || 'Failed to rename file')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="rename-modal-overlay"
      className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div data-testid="rename-modal-content" className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-4">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</div>
            <button
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-50"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-5">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            placeholder="New name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
          {error && <div className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</div>}
        </div>
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

