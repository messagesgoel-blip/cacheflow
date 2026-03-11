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
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(6,8,12,0.72)] p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div data-testid="rename-modal-content" className="cf-liquid w-full max-w-md overflow-hidden rounded-[28px] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-strong)]" onClick={e => e.stopPropagation()}>
        <div className="cf-toolbar-card border-b border-[var(--cf-border)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-base font-semibold tracking-[-0.03em] text-[var(--cf-text-0)]">{title}</div>
            <button
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="rounded-2xl p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] disabled:opacity-50"
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
            className="w-full rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[var(--cf-text-0)] outline-none transition focus:border-[var(--cf-blue)] disabled:opacity-50"
            placeholder="New name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
          {error && <div className="mt-2 text-sm text-[var(--cf-red)]">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--cf-border)] p-5">
          <button
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="rounded-2xl border border-[var(--cf-border)] px-3 py-2 text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-2xl border border-[rgba(116,174,252,0.26)] bg-[rgba(116,174,252,0.16)] px-4 py-2 text-[var(--cf-blue)] hover:bg-[rgba(116,174,252,0.22)] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cf-blue)]/25 border-t-[var(--cf-blue)]" />
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
