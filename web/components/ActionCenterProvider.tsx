'use client'

import React, { createContext, useContext, useMemo, useRef, useState } from 'react'

type BannerKind = 'info' | 'success' | 'error' | 'progress' | 'warning'

type Banner = {
  id: string
  key?: string
  kind: BannerKind
  title: string
  message?: string
  progress?: number | null
  ttlMs?: number
}

type ConfirmState = {
  open: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  resolve?: (v: boolean) => void
}

type PromptState = {
  open: boolean
  title: string
  message?: string
  initial?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  resolve?: (v: string | null) => void
}

type NotifyInput = Omit<Banner, 'id'>

type TaskHandle = {
  id: string
  update: (patch: { title?: string; message?: string; progress?: number | null }) => void
  succeed: (message?: string) => void
  fail: (message?: string) => void
  dismiss: () => void
}

type ActionCenterApi = {
  notify: (input: NotifyInput) => void
  dismissBanner: (id: string) => void
  startTask: (input: { title: string; message?: string; progress?: number | null; key?: string }) => TaskHandle
  confirm: (input: { title: string; message?: string; confirmText?: string; cancelText?: string }) => Promise<boolean>
  prompt: (input: { title: string; message?: string; initial?: string; placeholder?: string; confirmText?: string; cancelText?: string }) => Promise<string | null>
}

const ActionCenterContext = createContext<ActionCenterApi | null>(null)

export function useActionCenter(): ActionCenterApi {
  const ctx = useContext(ActionCenterContext)
  if (!ctx) throw new Error('useActionCenter must be used within ActionCenterProvider')
  return ctx
}

function classFor(kind: BannerKind): string {
  switch (kind) {
    case 'success':
      return 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100'
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100'
    case 'progress':
      return 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100'
    default:
      return 'border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
  }
}

function ProgressBar({ progress }: { progress?: number | null }) {
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
  return (
    <div className="mt-2 h-2 w-full rounded-full bg-blue-100 dark:bg-blue-950/60 overflow-hidden">
      {pct === null ? (
        <div className="h-full w-1/3 bg-blue-500/70 animate-[pulse_1.2s_ease-in-out_infinite]" />
      ) : (
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      )}
    </div>
  )
}

export default function ActionCenterProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, title: '' })
  const [promptState, setPromptState] = useState<PromptState>({ open: false, title: '' })
  const promptInputRef = useRef<HTMLInputElement | null>(null)
  const idSeq = useRef(0)

  const api = useMemo<ActionCenterApi>(() => {
    function nextId(prefix: string) {
      idSeq.current += 1
      return `${prefix}-${Date.now()}-${idSeq.current}`
    }

    function notify(input: NotifyInput) {
      const id = nextId('banner')
      const ttlMs = input.ttlMs ?? (input.kind === 'error' ? 5000 : 2500)
      setBanners((prev) => {
        const withoutExisting = input.key ? prev.filter((b) => b.key !== input.key) : prev
        return [...withoutExisting, { ...input, id, ttlMs }]
      })
      window.setTimeout(() => {
        setBanners((prev) => prev.filter((b) => b.id !== id))
      }, ttlMs)
    }

    function dismissBanner(id: string) {
      setBanners((prev) => prev.filter((b) => b.id !== id))
    }

    function startTask(input: { title: string; message?: string; progress?: number | null; key?: string }): TaskHandle {
      const id = nextId('task')
      setBanners((prev) => {
        const withoutExisting = input.key ? prev.filter((b) => b.key !== input.key) : prev
        return [
          ...withoutExisting,
          {
            id,
            key: input.key,
            kind: 'progress',
            title: input.title,
            message: input.message,
            progress: input.progress ?? null,
          },
        ]
      })

      function update(patch: { title?: string; message?: string; progress?: number | null }) {
        setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch, kind: 'progress' } : b)))
      }

      function done(kind: 'success' | 'error', message?: string) {
        setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, kind, message: message ?? b.message, progress: undefined, ttlMs: 2500 } : b)))
        window.setTimeout(() => {
          setBanners((prev) => prev.filter((b) => b.id !== id))
        }, 2500)
      }

      return {
        id,
        update,
        succeed: (message?: string) => done('success', message),
        fail: (message?: string) => done('error', message),
        dismiss: () => dismissBanner(id)
      }
    }

    function confirm(input: { title: string; message?: string; confirmText?: string; cancelText?: string }) {
      return new Promise<boolean>((resolve) => {
        setConfirmState({ open: true, title: input.title, message: input.message, confirmText: input.confirmText, cancelText: input.cancelText, resolve })
      })
    }

    function prompt(input: { title: string; message?: string; initial?: string; placeholder?: string; confirmText?: string; cancelText?: string }) {
      return new Promise<string | null>((resolve) => {
        setPromptState({ open: true, title: input.title, message: input.message, initial: input.initial, placeholder: input.placeholder, confirmText: input.confirmText, cancelText: input.cancelText, resolve })
        window.setTimeout(() => promptInputRef.current?.focus(), 0)
      })
    }

    return { notify, dismissBanner, startTask, confirm, prompt }
  }, [])

  return (
    <ActionCenterContext.Provider value={api}>
      {children}

      {/* Banners */}
      <div className="fixed top-4 right-4 z-[1000] w-[360px] max-w-[calc(100vw-2rem)] space-y-2">
        {banners.map((b) => (
          <div key={b.id} className={`rounded-xl border px-4 py-3 shadow-sm ${classFor(b.kind)}`}>
            <div className="text-sm font-semibold">{b.title}</div>
            {b.message && <div className="mt-0.5 text-sm opacity-90">{b.message}</div>}
            {b.kind === 'progress' && <ProgressBar progress={b.progress ?? null} />}
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState.open && (
        <div data-testid="cf-confirm-modal-overlay" className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">
          <div
            data-testid="cf-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cf-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-5"
          >
            <div id="cf-confirm-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{confirmState.title}</div>
            {confirmState.message && <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{confirmState.message}</div>}
            <div className="mt-5 flex gap-2 justify-end">
              <button
                data-testid="cf-confirm-cancel"
                onClick={() => {
                  confirmState.resolve?.(false)
                  setConfirmState({ open: false, title: '' })
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {confirmState.cancelText || 'Cancel'}
              </button>
              <button
                data-testid="cf-confirm-confirm"
                onClick={() => {
                  confirmState.resolve?.(true)
                  setConfirmState({ open: false, title: '' })
                }}
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {confirmState.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt modal */}
      {promptState.open && (
        <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-5">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{promptState.title}</div>
            {promptState.message && <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{promptState.message}</div>}
            <input
              ref={promptInputRef}
              defaultValue={promptState.initial || ''}
              placeholder={promptState.placeholder || ''}
              className="mt-4 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => {
                  promptState.resolve?.(null)
                  setPromptState({ open: false, title: '' })
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {promptState.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const v = promptInputRef.current?.value ?? ''
                  promptState.resolve?.(v)
                  setPromptState({ open: false, title: '' })
                }}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {promptState.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ActionCenterContext.Provider>
  )
}
