'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProviderId, FileMetadata, PROVIDERS } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { normalizePath } from '@/lib/utils/path'

type Mode = 'copy' | 'move'

function providerName(providerId: ProviderId): string {
  return PROVIDERS.find((provider) => provider.id === providerId)?.name || providerId
}

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
    return connectedProviderIds.filter((pid) => tokenManager.getTokens(pid).some((token) => !token.disabled))
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
    const labels = stack.map((segment) => segment.label)
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
      ? availableProviders.find((providerId) => providerId !== sourceProvider)
      : undefined

    if (differentProvider) {
      setTargetProviderId(differentProvider)
      return
    }

    if (sourceProvider && availableProviders.includes(sourceProvider)) {
      setTargetProviderId(sourceProvider)
      return
    }

    if (availableProviders.length > 0) {
      setTargetProviderId(availableProviders[0])
    }
  }, [isOpen, file, availableProviders])

  useEffect(() => {
    const handleGlobalEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isSubmitting) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleGlobalEsc)
    return () => window.removeEventListener('keydown', handleGlobalEsc)
  }, [isOpen, isSubmitting, onClose])

  useEffect(() => {
    if (!isOpen) return
    const tokens = tokenManager.getTokens(targetProviderId).filter((token) => !token.disabled)
    const key = tokens[0]?.accountKey || tokens[0]?.accountEmail || ''
    setTargetAccountKey(key)
    setStack(buildInitialStack(targetProviderId, file, currentFolderPath))
  }, [isOpen, targetProviderId, file, currentFolderPath])

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

      const response = await provider.listFiles({ folderId: folderIdForApi })
      const onlyFolders = response.files.filter((entry) => entry.isFolder)
      onlyFolders.sort((left, right) => left.name.localeCompare(right.name))
      setFolders(onlyFolders)
    } catch (err: any) {
      console.error('[TransferModal] Failed to load folders:', err)
      setError(err?.message || 'Failed to load folders')
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !file) return null

  const tokens = tokenManager.getTokens(targetProviderId).filter((token) => !token.disabled)
  const sourceProviderName = providerName(file.provider as ProviderId)
  const targetProviderName = providerName(targetProviderId)

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
        timeoutPromise,
      ])
    } catch (err: any) {
      setError(err?.message || 'Transfer failed')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="transfer-modal-overlay"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        data-testid="transfer-modal-content"
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-strong)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--cf-border)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="cf-kicker">{mode === 'copy' ? 'Transfer Copy' : 'Transfer Move'}</div>
              <div className="mt-2 text-lg font-semibold text-[var(--cf-text-0)]">{mode === 'copy' ? 'Copy file' : 'Move file'}</div>
              <div className="mt-1 truncate text-sm text-[var(--cf-text-1)]">{file.name}</div>
            </div>
            <button
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="rounded-xl p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] disabled:opacity-50"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.1)] p-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Source</div>
              <div className="mt-2 text-sm font-semibold text-[var(--cf-text-0)]">{sourceProviderName}</div>
              <div className="mt-1 truncate text-[11px] text-[var(--cf-text-2)]">{file.name}</div>
            </div>
            <div className="rounded-2xl border border-[rgba(0,201,167,0.22)] bg-[rgba(0,201,167,0.1)] p-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Destination</div>
              <div className="mt-2 text-sm font-semibold text-[var(--cf-text-0)]">{targetProviderName}</div>
              <div className="mt-1 truncate text-[11px] text-[var(--cf-text-2)]">{destinationPath}</div>
            </div>
            <div className="rounded-2xl border border-[rgba(255,159,67,0.22)] bg-[rgba(255,159,67,0.1)] p-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Action</div>
              <div className="mt-2 text-sm font-semibold text-[var(--cf-text-0)]">{mode === 'copy' ? 'Duplicate into target' : 'Move into target'}</div>
              <div className="mt-1 text-[11px] text-[var(--cf-text-2)]">
                {mode === 'copy' ? 'Source remains untouched.' : 'Source will be removed after transfer.'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-[1.05fr_1fr]">
          <div>
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Target provider</label>
            <select
              aria-label="Target provider"
              value={targetProviderId}
              onChange={(event) => setTargetProviderId(event.target.value as ProviderId)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] disabled:opacity-50"
            >
              {availableProviders.map((providerId) => (
                <option key={providerId} value={providerId}>
                  {providerName(providerId)}
                </option>
              ))}
            </select>

            <label className="mt-5 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Target account</label>
            <select
              aria-label="Target account"
              value={targetAccountKey}
              onChange={(event) => setTargetAccountKey(event.target.value)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] disabled:opacity-50"
            >
              {tokens.map((token, index) => {
                const key = token.accountKey || token.accountEmail || `${targetProviderId}-${index}`
                return (
                  <option key={key} value={key}>
                    {token.displayName || token.accountEmail || `${targetProviderId}-${index + 1}`}
                  </option>
                )
              })}
            </select>

            <label className="mt-5 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Destination folder</label>
            <div data-testid="transfer-dest-path" className="mt-2 rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 font-mono text-sm text-[var(--cf-text-0)] truncate">
              {destinationPath}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {stack.map((segment, index) => (
                <button
                  key={`${segment.id}-${index}`}
                  onClick={() => !isSubmitting && setStack((previous) => previous.slice(0, index + 1))}
                  disabled={isSubmitting}
                  className="rounded-full border border-[var(--cf-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] disabled:opacity-50"
                >
                  {index === 0 ? '/' : segment.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex h-[320px] flex-col overflow-hidden rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-bg)]">
            <div className="flex items-center justify-between border-b border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Folder browser</div>
                <div className="mt-1 text-sm font-medium text-[var(--cf-text-0)]">Choose a destination</div>
              </div>
              {loading && <div className="animate-pulse font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cf-blue)]">Loading</div>}
            </div>

            {error && (
              <div className="flex flex-col gap-2 border-b border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">
                <p>{error}</p>
                <button
                  onClick={() => void loadFolders()}
                  className="text-left font-mono text-[10px] font-bold uppercase tracking-[0.12em] underline"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {folders.length === 0 && !loading && !error ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--cf-text-2)]">No folders found</div>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => !isSubmitting && setStack((previous) => [...previous, { id: folder.id, label: folder.name }])}
                    disabled={isSubmitting}
                    className="group flex w-full items-center gap-3 border-b border-[var(--cf-border)]/70 px-4 py-3 text-left text-sm text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] disabled:opacity-50"
                  >
                    <span className="rounded-xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.1)] px-2 py-1 text-[12px] transition group-hover:scale-105">
                      📁
                    </span>
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--cf-border)] px-6 py-5">
          <button
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="rounded-xl border border-[var(--cf-border)] px-4 py-2 text-sm font-medium text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2 text-sm font-semibold text-[var(--cf-blue)] hover:bg-[rgba(74,158,255,0.2)] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cf-blue)]/25 border-t-[var(--cf-blue)]" />
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
