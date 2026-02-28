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
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setValue(initialValue)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen, initialValue])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-4">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
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
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            placeholder="New name"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter') {
                void (async () => {
                  if (!value.trim()) { setError('Name is required'); return }
                  await onSubmit(value.trim())
                })()
              }
            }}
          />
          {error && <div className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</div>}
        </div>
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!value.trim()) { setError('Name is required'); return }
              await onSubmit(value.trim())
            }}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
