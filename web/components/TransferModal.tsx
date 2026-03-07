'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProviderId, FileMetadata, PROVIDERS } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { normalizePath } from '@/lib/utils/path'

type Mode = 'copy' | 'move'

export default function TransferModal({
  isOpen,
  mode,
  file,
  currentFolderPath,
  connectedProviderIds,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  mode: Mode
  file: FileMetadata | null
  currentFolderPath?: string
  connectedProviderIds: ProviderId[]
  onClose: () => void
  onSubmit: (args: { targetProviderId: ProviderId; targetAccountKey: string; targetFolderId: string }) => Promise<void>
}) {
  const availableProviders = useMemo(() => {
    return connectedProviderIds.filter((pid) => tokenManager.getTokens(pid).some((t) => !t.disabled))
  }, [connectedProviderIds])

  const [targetProviderId, setTargetProviderId] = useState<ProviderId>('google')
  const [targetAccountKey, setTargetAccountKey] = useState<string>('')
  const [stack, setStack] = useState<Array<{ id: string; label: string }>>([{ id: 'root', label: '/' }])
  const [folders, setFolders] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentFolderId = stack[stack.length - 1]?.id || ''

  const destinationPath = useMemo(() => {
    const labels = stack.map(s => s.label)
    // Avoid double slash if root is already /
    return normalizePath(...labels)
  }, [stack])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, file?.provider, availableProviders])

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false)
      setError(null)
      return
    }
    const sourceProvider = file?.provider as ProviderId | undefined
    const differentProvider = sourceProvider
      ? availableProviders.find((pid) => pid !== sourceProvider)
      : undefined

    if (differentProvider) {
      setTargetProviderId(differentProvider)
      return
    }

    if (sourceProvider && availableProviders.includes(sourceProvider)) {
      setTargetProviderId(sourceProvider)
      return
    }

    if (availableProviders.length) {
      setTargetProviderId(availableProviders[0])
    }
  }, [isOpen])

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

  useEffect(() => {
    if (!isOpen) return
    const tokens = tokenManager.getTokens(targetProviderId).filter((t) => !t.disabled)
    const key = tokens[0]?.accountKey || tokens[0]?.accountEmail || ''
    setTargetAccountKey(key)
    setStack(buildInitialStack(targetProviderId, file, currentFolderPath))
  }, [isOpen, targetProviderId])

  useEffect(() => {
    if (!isOpen) return
    setStack(buildInitialStack(targetProviderId, file, currentFolderPath))
    setFolders([])
    setError(null)
  }, [isOpen, targetProviderId, targetAccountKey, file, currentFolderPath])

  useEffect(() => {
    if (!isOpen) return
    void loadFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetProviderId, targetAccountKey, currentFolderId])

  async function loadFolders() {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    try {
      if (targetAccountKey) {
        tokenManager.setActiveToken(targetProviderId, targetAccountKey)
      }
      const provider = getProvider(targetProviderId)
      if (!provider) throw new Error('Provider not available')
      
      // Ensure provider instance has the correct remoteId for this specific account
      const currentToken = tokenManager.getToken(targetProviderId, targetAccountKey)
      provider.remoteId = (currentToken as any)?.remoteId

      const needsVpsRootCorrection =
        targetProviderId === 'vps' &&
        currentFolderId === 'root' &&
        Boolean(currentFolderPath)
      const folderIdForApi = needsVpsRootCorrection
        ? normalizePath(currentFolderPath || '/')
        : currentFolderId || rootFolderId(targetProviderId)
      if (needsVpsRootCorrection) {
        setStack(buildInitialStack(targetProviderId, file, currentFolderPath))
      }
      const res = await provider.listFiles({ folderId: folderIdForApi })
      const onlyFolders = res.files.filter((f) => f.isFolder)
      onlyFolders.sort((a, b) => a.name.localeCompare(b.name))
      setFolders(onlyFolders)
    } catch (e: any) {
      console.error('[TransferModal] Failed to load folders:', e)
      setError(e?.message || 'Failed to load folders')
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !file) return null

  const tokens = tokenManager.getTokens(targetProviderId).filter((t) => !t.disabled)

  const handleSubmit = async () => {
    if (isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), 60000))
      await Promise.race([
        onSubmit({
          targetProviderId,
          targetAccountKey,
          targetFolderId: currentFolderId || rootFolderId(targetProviderId),
        }),
        timeoutPromise
      ])
      // Success is handled by parent unmounting us
    } catch (err: any) {
      setError(err?.message || 'Transfer failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="transfer-modal-overlay"
      className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div data-testid="transfer-modal-content" className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{mode === 'copy' ? 'Copy' : 'Move'} file</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">{file.name}</div>
            </div>
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

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Target provider</label>
            <select
              aria-label="Target provider"
              value={targetProviderId}
              onChange={(e) => setTargetProviderId(e.target.value as ProviderId)}
              disabled={isSubmitting}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            >
              {availableProviders.map((pid) => (
                <option key={pid} value={pid}>
                  {PROVIDERS.find((p) => p.id === pid)?.name || pid}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold text-gray-700 dark:text-gray-300">Target account</label>
            <select
              aria-label="Target account"
              value={targetAccountKey}
              onChange={(e) => setTargetAccountKey(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            >
              {tokens.map((t, idx) => {
                const k = t.accountKey || t.accountEmail || `${targetProviderId}-${idx}`
                return (
                  <option key={k} value={k}>
                    {t.displayName || t.accountEmail || `${targetProviderId}-${idx + 1}`}
                  </option>
                )
              })}
            </select>

            <label className="mt-4 block text-xs font-semibold text-gray-700 dark:text-gray-300">Destination folder</label>
            <div data-testid="transfer-dest-path" className="mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 font-mono truncate">
              {destinationPath}
            </div>
            
            <div className="mt-2 flex flex-wrap gap-1">
              {stack.map((s, i) => (
                <button
                  key={`${s.id}-${i}`}
                  onClick={() => !isSubmitting && setStack((prev) => prev.slice(0, i + 1))}
                  disabled={isSubmitting}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {i === 0 ? '/' : s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-[300px]">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Folders</div>
              {loading && <div className="text-xs text-gray-500 animate-pulse">Loading…</div>}
            </div>
            
            {error && (
              <div className="px-4 py-3 text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 flex flex-col gap-2">
                <p>{error}</p>
                <button 
                  onClick={() => loadFolders()}
                  className="text-xs font-semibold underline text-left"
                >
                  Retry
                </button>
              </div>
            )}
            
            <div className="flex-1 overflow-auto">
              {folders.length === 0 && !loading && !error ? (
                <div className="px-4 py-6 text-sm text-gray-500 text-center italic">No folders found</div>
              ) : (
                folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => !isSubmitting && setStack((prev) => [...prev, { id: f.id, label: f.name }])}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50 group"
                  >
                    <span className="group-hover:scale-110 transition-transform">📁</span>
                    <span className="truncate">{f.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
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
                {mode === 'copy' ? 'Copying...' : 'Moving...'}
              </>
            ) : (
              mode === 'copy' ? 'Copy here' : 'Move here'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function rootFolderId(providerId: ProviderId): string {
  switch (providerId) {
    case 'google':
    case 'onedrive':
      return 'root'
    case 'box':
    case 'pcloud':
      return '0'
    case 'dropbox':
    case 'filen':
      return ''
    case 'webdav':
    case 'vps':
    case 'yandex':
      return '/'
    default:
      return 'root'
  }
}

export function buildInitialStack(
  providerId: ProviderId,
  file: FileMetadata | null,
  currentFolderPath?: string,
): Array<{ id: string; label: string }> {
  if (providerId !== 'vps' || !file) {
    return [{ id: rootFolderId(providerId), label: '/' }]
  }

  const targetPath = getInitialVpsTargetPath(file, currentFolderPath)
  if (targetPath === '/') {
    return [{ id: '/', label: '/' }]
  }

  const segments = targetPath.split('/').filter(Boolean)
  const stack = [{ id: '/', label: '/' }]
  let current = ''
  for (const segment of segments) {
    current = `${current}/${segment}`
    stack.push({ id: current, label: segment })
  }
  return stack
}

export function getInitialVpsTargetPath(file: FileMetadata, currentFolderPath?: string): string {
  const normalized = normalizePath(file.path || '/')
  const normalizedCurrentFolder = normalizePath(currentFolderPath || '/')
  if (file.isFolder) return normalized
  if (normalized === '/' || !normalized.includes('/')) return normalizedCurrentFolder
  const trimmed = normalized.replace(/\/+$/, '')
  const lastSlash = trimmed.lastIndexOf('/')
  const parentPath = lastSlash <= 0 ? '/' : trimmed.slice(0, lastSlash)
  if (parentPath === '/' && normalizedCurrentFolder !== '/') {
    return normalizedCurrentFolder
  }
  return parentPath
}
