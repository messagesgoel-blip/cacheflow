'use client'

import { useState, useEffect } from 'react'
import { ProviderId, FileMetadata, PROVIDERS, formatBytes } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import { transferFileBetweenProviders } from '@/lib/transfer/crossProvider'
import { tokenManager } from '@/lib/tokenManager'
import { metadataCache } from '@/lib/metadataCache'
import { actionLogger } from '@/lib/logger'
import { useActionCenter } from '@/components/ActionCenterProvider'
import TransferModal from '@/components/TransferModal'
import RenameModal from '@/components/RenameModal'

interface ConnectedProvider {
  providerId: ProviderId
  accountEmail: string
  displayName: string
  accountKey?: string
}

interface UnifiedFileBrowserProps {
  token: string
}

export default function UnifiedFileBrowser({ token }: UnifiedFileBrowserProps) {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProviders, setLoadingProviders] = useState<ProviderId[]>([])
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'all'>('all')
  const [activeAccountKey, setActiveAccountKey] = useState<string>('')
  const [currentPath, setCurrentPath] = useState('/')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const actions = useActionCenter()
  const [transferModal, setTransferModal] = useState<{ open: boolean; mode: 'copy' | 'move'; file: FileMetadata | null; correlationId?: string }>({ open: false, mode: 'copy', file: null })
  const [renameModal, setRenameModal] = useState<{ open: boolean; file: FileMetadata | null; correlationId?: string }>({ open: false, file: null })
  const [previewModal, setPreviewModal] = useState<{ open: boolean; file: FileMetadata | null; url: string | null; type: string | null; correlationId?: string }>({ open: false, file: null, url: null, type: null })

  // Load connected providers from tokenManager
  useEffect(() => {
    // QA Seeding: Automatically connect a mock provider if none connected
    if (typeof window !== 'undefined' && tokenManager.getConnectedProviders().length === 0) {
      console.log('[QA] Seeding mock Filen token for testing');
      tokenManager.saveToken('filen', {
        provider: 'filen',
        accessToken: 'mock-qa-token',
        accountEmail: 'qa-tester@filen.io',
        displayName: 'QA Mock Drive',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000
      });
    }

    // Always connect 'local' provider if we have a main app token
    if (token && !tokenManager.hasToken('local')) {
      tokenManager.saveToken('local', {
        provider: 'local',
        accessToken: token,
        accountEmail: 'local-storage',
        displayName: 'Local Storage',
        expiresAt: null
      });
    }

    setRefreshKey(k => k + 1);
    setLoading(true)
    setError(null)
    const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'vps', 'webdav', 'local']
    const connected: ConnectedProvider[] = []
    const loadingIds: ProviderId[] = []

    // Load cloud providers from tokenManager (multiple per provider)
    for (const pid of providerIds) {
      const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
      if (tokens.length) {
        loadingIds.push(pid)
      }
      tokens.forEach((token, idx) => {
        if (token && token.accessToken) {
          connected.push({
            providerId: pid,
            accountEmail: token.accountEmail || '',
            displayName: token.displayName || `${pid}-${idx + 1}`,
            accountKey: token.accountKey,
          })
        }
      })
    }

    setConnectedProviders(connected)
    setLoadingProviders(loadingIds)

    // Load files from connected providers
    async function loadAllFiles() {
      setLoading(true)
      setError(null)
      const allFiles: FileMetadata[] = []
      const errors: string[] = []

      const providerIdsToLoad: ProviderId[] = (selectedProvider === 'all')
        ? loadingIds
        : ([selectedProvider] as ProviderId[])

      for (const pid of providerIdsToLoad) {
        try {
          const provider = getProvider(pid)
          if (!provider) continue

          // In "all" mode, we can only reliably show root across providers.
          const folderIdForApi = (selectedProvider === 'all')
            ? rootFolderId(pid)
            : (currentPath === '/' ? rootFolderId(pid) : currentPath)

          // If "all", list once per enabled account so we can tag results with source account.
          if (selectedProvider === 'all') {
            const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
            for (const t of tokens) {
              const key = t.accountKey || t.accountEmail || ''
              if (key) tokenManager.setActiveToken(pid, key)
              
              let resultFiles = []
              const cached = await metadataCache.getCachedFiles(pid, folderIdForApi)
              if (cached) {
                resultFiles = cached
              } else {
                const result = await provider.listFiles({ folderId: folderIdForApi })
                resultFiles = result.files
                await metadataCache.cacheFiles(pid, folderIdForApi, resultFiles)
              }
              
              const providerConfig = PROVIDERS.find(p => p.id === pid)
              const sourceLabel = (t.accountEmail ? t.accountEmail.split('@')[0] : (t.displayName || providerConfig?.name || pid))

              const filesWithSource = resultFiles.map(file => ({
                ...file,
                provider: pid,
                providerName: providerConfig?.name || pid,
                accountKey: key,
                accountEmail: t.accountEmail,
                sourceLabel,
              } as any))

              allFiles.push(...filesWithSource)
            }
          } else {
            // Provider-specific view: list only the active enabled account
            const t = tokenManager.getToken(pid) as any
            const key = t?.accountKey || t?.accountEmail || ''
            
            let resultFiles = []
            const cached = await metadataCache.getCachedFiles(pid, folderIdForApi)
            if (cached) {
              resultFiles = cached
            } else {
              const result = await provider.listFiles({ folderId: folderIdForApi })
              resultFiles = result.files
              await metadataCache.cacheFiles(pid, folderIdForApi, resultFiles)
            }
            
            const providerConfig = PROVIDERS.find(p => p.id === pid)
            const sourceLabel = (t?.accountEmail ? t.accountEmail.split('@')[0] : (t?.displayName || providerConfig?.name || pid))

            const filesWithSource = resultFiles.map(file => ({
              ...file,
              provider: pid,
              providerName: providerConfig?.name || pid,
              accountKey: key,
              accountEmail: t?.accountEmail,
              sourceLabel,
            } as any))

            allFiles.push(...filesWithSource)
          }
        } catch (err: any) {
          console.error(`Error loading files from ${pid}:`, err)
          errors.push(`${pid}: ${err.message}`)
        }
      }

      if (errors.length > 0) {
        setError(`Some providers failed to load: ${errors.join(', ')}`)
      }

      setFiles(allFiles)
      setSelectedFiles(new Set())
      setLoading(false)
    }

    loadAllFiles()
  }, [token, currentPath, selectedProvider, refreshKey])

  // Update active account when provider selection changes
  useEffect(() => {
    if (selectedProvider === 'all') {
      setCurrentPath('/')
      return
    }
    const tokens = tokenManager.getTokens(selectedProvider).filter(t => !t.disabled)
    if (tokens.length) {
      const key = tokens[0].accountKey || tokens[0].accountEmail || ''
      setActiveAccountKey(key)
      tokenManager.setActiveToken(selectedProvider, key)
      setRefreshKey((k) => k + 1)
    }
  }, [selectedProvider])

  // Close modals on path or provider change
  useEffect(() => {
    if (renameModal.open || transferModal.open || previewModal.open) {
      console.log('[ModalManager] Closing modals due to path/provider change')
      setRenameModal({ open: false, file: null })
      setTransferModal({ open: false, mode: 'copy', file: null })
      setPreviewModal(prev => {
        if (prev.url) URL.revokeObjectURL(prev.url)
        return { open: false, file: null, url: null, type: null }
      })
    }
  }, [currentPath, selectedProvider])

  // Cleanup effect to ensure no stale overlays linger when all modals are closed
  useEffect(() => {
    const isAnyModalOpen = renameModal.open || transferModal.open || previewModal.open
    
    if (!isAnyModalOpen) {
      // Synchronous cleanup of potential stale DOM nodes
      const overlays = document.querySelectorAll('[data-testid$="-modal-overlay"], .z-\\[1200\\], .z-\\[100\\]')
      if (overlays.length > 0) {
        console.warn('[ModalManager] Found stale overlays while state says closed. Cleaning up:', overlays.length)
        overlays.forEach(el => {
          if (el instanceof HTMLElement) el.remove()
        })
      }
      document.body.style.overflow = ''
    }
  }, [renameModal.open, transferModal.open, previewModal.open])

  // Filter files by provider
  const filteredFiles = files.filter(f => {
    if (selectedProvider === 'all') return true
    return f.provider === selectedProvider
  })

  // Filter by search query
  const searchedFiles = searchQuery
    ? filteredFiles.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredFiles

  // Sort files
  const sortedFiles = [...searchedFiles].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'date':
        comparison = dateMsSafe(b.modifiedTime) - dateMsSafe(a.modifiedTime)
        break
      case 'size':
        comparison = b.size - a.size
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const hasConnectedAccounts = connectedProviders.length > 0
  const showLoadingState = loading
  const showNoProvidersState = !loading && !hasConnectedAccounts
  const showEmptyState = !loading && hasConnectedAccounts && sortedFiles.length === 0
  const showLoadedState = !loading && sortedFiles.length > 0

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  // Select all files
  const selectAll = () => {
    if (selectedFiles.size === sortedFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(sortedFiles.map(f => f.id)))
    }
  }

  // Handle folder click - navigate into folder
  const handleFolderClick = (folderPath: string) => {
    if (selectedProvider === 'all') {
      // Find clicked folder and switch into its provider
      const f = files.find(x => x.path === folderPath && x.isFolder)
      if (f?.provider) {
        setSelectedProvider(f.provider as any)
      }
    }
    setCurrentPath(folderPath)
  }

  // Handle breadcrumb click
  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path)
  }

  // File action handlers
  const handleFileDownload = async (file: FileMetadata) => {
    try {
      const task = actions.startTask({ title: 'Downloading', message: file.name, progress: null })
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider)
      if (provider) {
        const blob = await provider.downloadFile(file.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        task.update({ title: 'Download started' })
        task.succeed(`${file.name} (${providerLabel(file)})`)
      }
    } catch (err: any) {
      console.error('Download error:', err)
      actions.notify({ kind: 'error', title: 'Download failed', message: err.message })
    }
  }

  const handleFileShare = async (file: FileMetadata) => {
    try {
      const task = actions.startTask({ title: 'Getting share link', message: file.name, progress: null })
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider)
      if (provider) {
        const shareLink = await provider.getShareLink(file.id)
        if (shareLink) {
          await navigator.clipboard.writeText(shareLink)
          task.update({ title: 'Share link copied' })
          task.succeed(`${file.name} (${providerLabel(file)})`)
        } else {
          task.fail('No share link available')
        }
      }
    } catch (err: any) {
      console.error('Share error:', err)
      actions.notify({ kind: 'error', title: 'Share failed', message: err.message })
    }
  }

  const handleFileOpen = async (file: FileMetadata) => {
    const correlationId = actionLogger.generateCorrelationId()
    actionLogger.log({ event: 'modal_open', actionName: 'preview', fileId: file.id, providerId: file.provider, currentPath, correlationId })
    try {
      const task = actions.startTask({ title: 'Opening', message: file.name, progress: null })
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider)
      if (!provider) return
      
      actionLogger.log({ event: 'action_start', actionName: 'preview', fileId: file.id, providerId: file.provider, currentPath, correlationId })
      const blob = await provider.downloadFile(file.id)
      const url = URL.createObjectURL(blob)

      const isText = file.mimeType.startsWith('text/') || file.name.match(/\.(txt|md|csv|json|js|ts|jsx|tsx|html|css|py|java|c|cpp|go|rs|rb)$/i)
      const isImage = file.mimeType.startsWith('image/')
      const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

      if (isText || isImage || isPdf) {
        let type = 'text'
        if (isImage) type = 'image'
        if (isPdf) type = 'pdf'
        setPreviewModal({ open: true, file, url, type, correlationId })
        task.update({ title: 'Preview opened' })
        task.succeed(`${file.name} (${providerLabel(file)})`)
        actionLogger.log({ event: 'action_success', actionName: 'preview', fileId: file.id, providerId: file.provider, currentPath, correlationId })
      } else {
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 10000)
        task.update({ title: 'Opened in new tab' })
        task.succeed(`${file.name} (${providerLabel(file)})`)
        actionLogger.log({ event: 'action_success', actionName: 'open_tab', fileId: file.id, providerId: file.provider, currentPath, correlationId })
      }
    } catch (err: any) {
      console.error('Open error:', err)
      actionLogger.log({ event: 'action_fail', actionName: 'preview', fileId: file.id, providerId: file.provider, currentPath, correlationId, error: err.message })
      actions.notify({ kind: 'error', title: 'Open failed', message: err.message })
    }
  }

  const handleFileMove = async (file: FileMetadata) => {
    const correlationId = actionLogger.generateCorrelationId()
    actionLogger.log({ event: 'modal_open', actionName: 'move', fileId: file.id, providerId: file.provider, currentPath, correlationId })
    setTransferModal({ open: true, mode: 'move', file, correlationId })
  }

  const handleFileCopy = async (file: FileMetadata) => {
    const correlationId = actionLogger.generateCorrelationId()
    actionLogger.log({ event: 'modal_open', actionName: 'copy', fileId: file.id, providerId: file.provider, currentPath, correlationId })
    setTransferModal({ open: true, mode: 'copy', file, correlationId })
  }

  const handleFileRename = async (file: FileMetadata) => {
    const correlationId = actionLogger.generateCorrelationId()
    actionLogger.log({ event: 'modal_open', actionName: 'rename', fileId: file.id, providerId: file.provider, currentPath, correlationId })
    setRenameModal({ open: true, file, correlationId })
  }

  const handleFileDelete = async (file: FileMetadata) => {
    const ok = await actions.confirm({
      title: 'Delete file?',
      message: `Delete "${file.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!ok) return
    try {
      const task = actions.startTask({ title: 'Deleting', message: file.name, progress: null })
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider)
      if (provider) {
        await provider.deleteFile(file.id)
        await metadataCache.invalidateCache(file.provider as any)
        // Reload files
        setSelectedFiles(new Set())
        setLoading(true)
        setRefreshKey(k => k + 1)
        task.update({ title: 'Deleted' })
        task.succeed(`${file.name} (${providerLabel(file)})`)
      }
    } catch (err: any) {
      console.error('Delete error:', err)
      actions.notify({ kind: 'error', title: 'Delete failed', message: err.message })
    }
  }

  const handleCreateFolder = async () => {
    if (selectedProvider === 'all') {
      actions.notify({ kind: 'info', title: 'Select a provider', message: 'Choose a provider to create a folder.' })
      return
    }

    const providerId = selectedProvider as ProviderId
    const name = await actions.prompt({
      title: 'Create folder',
      message: 'Folder name',
      placeholder: 'New folder',
      confirmText: 'Create',
      cancelText: 'Cancel',
    })
    const trimmed = (name || '').trim()
    if (!trimmed) return

    const provider = getProvider(providerId)
    if (!provider) {
      actions.notify({ kind: 'error', title: 'Provider not available', message: providerId })
      return
    }

    try {
      const parentIdForApi = currentPath === '/' ? rootFolderId(providerId) : currentPath
      if (activeAccountKey) tokenManager.setActiveToken(providerId, activeAccountKey)
      const task = actions.startTask({ title: 'Creating folder', message: `${trimmed} (${PROVIDERS.find(p => p.id === providerId)?.name || providerId})`, progress: null })
      const folder = await provider.createFolder(trimmed, parentIdForApi)
      await metadataCache.invalidateCache(providerId)
      setSelectedFiles(new Set())
      setLoading(true)
      setRefreshKey((k) => k + 1)
      task.update({ title: 'Folder created' })
      task.succeed(`${folder.name} (${PROVIDERS.find(p => p.id === providerId)?.name || providerId})`)
    } catch (e: any) {
      actions.notify({ kind: 'error', title: 'Create folder failed', message: e?.message || 'Failed' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {previewModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => {
          actionLogger.log({ event: 'modal_close', actionName: 'preview', correlationId: previewModal.correlationId })
          if (previewModal.url) URL.revokeObjectURL(previewModal.url)
          setPreviewModal({ open: false, file: null, url: null, type: null })
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white truncate pr-4">{previewModal.file?.name}</h3>
              <button
                onClick={() => {
                  actionLogger.log({ event: 'modal_close', actionName: 'preview', correlationId: previewModal.correlationId })
                  if (previewModal.url) URL.revokeObjectURL(previewModal.url)
                  setPreviewModal({ open: false, file: null, url: null, type: null })
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4 flex justify-center items-center bg-gray-50 dark:bg-gray-900 rounded-b-lg">
              {previewModal.type === 'image' && (
                <img src={previewModal.url!} alt={previewModal.file?.name} className="max-w-full max-h-full object-contain" />
              )}
              {previewModal.type === 'pdf' && (
                <iframe src={previewModal.url!} className="w-full h-full border-0 rounded bg-white" title={previewModal.file?.name} />
              )}
              {previewModal.type === 'text' && (
                <iframe src={previewModal.url!} className="w-full h-full border border-gray-200 dark:border-gray-700 rounded bg-white" title={previewModal.file?.name} />
              )}
            </div>
          </div>
        </div>
      )}

      {transferModal.open && transferModal.file && (
        <TransferModal
          isOpen={transferModal.open}
          mode={transferModal.mode}
          file={transferModal.file}
          connectedProviderIds={Array.from(new Set(connectedProviders.map(cp => cp.providerId)))}
          onClose={() => {
            actionLogger.log({ event: 'modal_close', actionName: transferModal.mode, correlationId: transferModal.correlationId })
            setTransferModal({ open: false, mode: 'copy', file: null })
          }}
          onSubmit={async ({ targetProviderId, targetAccountKey, targetFolderId }) => {
            const file = transferModal.file
            if (!file) return
            
            const correlationId = transferModal.correlationId
            actionLogger.log({ event: 'action_start', actionName: transferModal.mode, fileId: file.id, providerId: file.provider, currentPath, correlationId })
            
            const task = actions.startTask({
              title: transferModal.mode === 'copy' ? 'Copying file' : 'Moving file',
              message: `${file.name} -> ${targetProviderId}`,
              progress: null,
            })
            try {
              // Ensure source account is active (multi-account)
              if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)

              // Ensure target account is active
              if (targetAccountKey) tokenManager.setActiveToken(targetProviderId, targetAccountKey)

              const source = getProvider(file.provider)
              const target = getProvider(targetProviderId)
              if (!source || !target) throw new Error('Provider not available')

              await transferFileBetweenProviders({
                source,
                target,
                file,
                targetFolderId,
                mode: transferModal.mode,
              })

              await metadataCache.invalidateCache(file.provider as any)
              await metadataCache.invalidateCache(targetProviderId)

              actionLogger.log({ event: 'modal_close', actionName: transferModal.mode, correlationId })
              setTransferModal({ open: false, mode: 'copy', file: null })
              setSelectedFiles(new Set())
              setLoading(true)
              setRefreshKey((k) => k + 1)
              const targetName = PROVIDERS.find(p => p.id === targetProviderId)?.name || targetProviderId
              const sourceName = PROVIDERS.find(p => p.id === (file.provider as any))?.name || (file.provider as any)
              task.update({ title: transferModal.mode === 'copy' ? 'Copied' : 'Moved' })
              task.succeed(`${file.name} (${sourceName} -> ${targetName})`)
              actionLogger.log({ event: 'action_success', actionName: transferModal.mode, fileId: file.id, providerId: file.provider, currentPath, correlationId })
            } catch (e: any) {
              actionLogger.log({ event: 'action_fail', actionName: transferModal.mode, fileId: file?.id, providerId: file?.provider, currentPath, correlationId, error: e?.message })
              task.fail(e?.message || 'Failed')
              throw e
            }
          }}
        />
      )}

      {renameModal.open && renameModal.file && (
        <RenameModal
          isOpen={renameModal.open}
          title="Rename"
          initialValue={renameModal.file?.name || ''}
          onClose={() => {
            actionLogger.log({ event: 'modal_close', actionName: 'rename', correlationId: renameModal.correlationId })
            setRenameModal({ open: false, file: null })
          }}
          onSubmit={async (newName) => {
            const file = renameModal.file
            if (!file || !newName || newName === file.name) {
              actionLogger.log({ event: 'modal_close', actionName: 'rename', correlationId: renameModal.correlationId })
              setRenameModal({ open: false, file: null })
              return
            }
            
            const correlationId = renameModal.correlationId
            actionLogger.log({ event: 'action_start', actionName: 'rename', fileId: file.id, providerId: file.provider, currentPath, correlationId })
            
            const task = actions.startTask({ title: 'Renaming', message: `${file.name} -> ${newName}`, progress: null })
            try {
              if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
              const provider = getProvider(file.provider)
              if (!provider) throw new Error('Provider not available')
              await provider.renameFile(file.id, newName)
              await metadataCache.invalidateCache(file.provider as any)
              
              actionLogger.log({ event: 'modal_close', actionName: 'rename', correlationId })
              setRenameModal({ open: false, file: null })
              setSelectedFiles(new Set())
              setLoading(true)
              setRefreshKey((k) => k + 1)
              task.update({ title: 'Renamed' })
              task.succeed(`${file.name} -> ${newName} (${providerLabel(file)})`)
              actionLogger.log({ event: 'action_success', actionName: 'rename', fileId: file.id, providerId: file.provider, currentPath, correlationId })
            } catch (e: any) {
              actionLogger.log({ event: 'action_fail', actionName: 'rename', fileId: file?.id, providerId: file?.provider, currentPath, correlationId, error: e?.message })
              task.fail(e?.message || 'Failed')
              throw e
            }
          }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Provider Filter */}
        <select
          aria-label="Provider filter"
          data-testid="files-provider-filter"
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value as ProviderId | 'all')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Providers ({connectedProviders.length} accounts connected)</option>
          {Array.from(new Set(connectedProviders.map(cp => cp.providerId))).map(pid => (
            <option key={pid} value={pid}>
              {PROVIDERS.find(p => p.id === pid)?.name}
            </option>
          ))}
        </select>

        {selectedProvider !== 'all' && (
          <select
            aria-label="Account filter"
            data-testid="files-account-filter"
            value={activeAccountKey}
            onChange={(e) => {
              const key = e.target.value
              setActiveAccountKey(key)
              tokenManager.setActiveToken(selectedProvider as ProviderId, key)
              setRefreshKey((k) => k + 1)
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {tokenManager.getTokens(selectedProvider as ProviderId).filter(t => !t.disabled).map((t, idx) => {
              const key = t.accountKey || t.accountEmail || `${selectedProvider}-${idx}`
              return (
                <option key={key} value={key}>
                  {t.displayName || t.accountEmail || `${selectedProvider}-${idx+1}`}
                </option>
              )
            })}
          </select>
        )}

        {/* Sort */}
        <select
          aria-label="Sort"
          data-testid="files-sort"
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split('-') as ['name' | 'date' | 'size', 'asc' | 'desc']
            setSortBy(by)
            setSortOrder(order)
          }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="size-desc">Largest First</option>
          <option value="size-asc">Smallest First</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-600`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-600`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>

        <button
          onClick={async () => {
            if (selectedProvider === 'all') {
              for (const pid of connectedProviders.map(p => p.providerId)) {
                await metadataCache.invalidateCache(pid)
              }
            } else {
              await metadataCache.invalidateCache(selectedProvider)
            }
            setRefreshKey((k) => k + 1)
          }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
          data-testid="files-refresh"
        >
          Refresh
        </button>

        {selectedProvider !== 'all' && (
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            data-testid="files-new-folder"
          >
            New folder
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Selection Bar (when files selected) */}
      {selectedFiles.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
          <span className="text-blue-700 dark:text-blue-300">
            {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
              Copy to...
            </button>
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
              Move to...
            </button>
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
              Download
            </button>
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Strict list state handling */}
      {showLoadingState ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Loading files</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fetching latest listings…</p>
            </div>
          </div>
          <div className="px-6 pb-6 grid grid-cols-1 gap-3">
            <div className="h-10 rounded bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
            <div className="h-10 rounded bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
            <div className="h-10 rounded bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
          </div>
        </div>
      ) : showNoProvidersState ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-lg mb-2">No cloud providers connected</p>
          <p className="text-sm mb-4">Connect a cloud storage provider to browse your files</p>
          <a
            href="/remotes"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Connect Provider
          </a>
        </div>
      ) : showEmptyState ? (
        <>
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            0 files{selectedProvider !== 'all' ? ` on ${PROVIDERS.find(p => p.id === selectedProvider)?.name}` : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-lg">No files found</p>
          <p className="text-sm mt-1 mb-4">Try a different provider/account or upload a new file.</p>
          <div className="flex gap-2">
            <a
              href="/remotes"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage Drives
            </a>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>
          {selectedProvider !== 'all' && (
            <button
              onClick={() => setSelectedProvider('all')}
              className="mt-2 text-blue-500 hover:underline"
            >
              Show files from all providers
            </button>
          )}
        </div>
        </>
      ) : showLoadedState && viewMode === 'list' ? (
        /* List View */
        <>
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''}
            {selectedProvider !== 'all' && ` on ${PROVIDERS.find(p => p.id === selectedProvider)?.name}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Modified
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  selected={selectedFiles.has(file.id)}
                  onSelect={() => toggleFileSelection(file.id)}
                  onFolderClick={handleFolderClick}
                  onOpen={handleFileOpen}
                  onDownload={handleFileDownload}
                  onShare={handleFileShare}
                  onRename={handleFileRename}
                  onMove={handleFileMove}
                  onCopy={handleFileCopy}
                  onDelete={handleFileDelete}
                  showProviderBadge={selectedProvider === 'all'}
                />
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        /* Grid View */
        <>
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''}
            {selectedProvider !== 'all' && ` on ${PROVIDERS.find(p => p.id === selectedProvider)?.name}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                selected={selectedFiles.has(file.id)}
                onSelect={() => toggleFileSelection(file.id)}
                onFolderClick={handleFolderClick}
                onOpen={handleFileOpen}
                onDownload={handleFileDownload}
                onShare={handleFileShare}
                onRename={handleFileRename}
                onMove={handleFileMove}
                onCopy={handleFileCopy}
                onDelete={handleFileDelete}
                showProviderBadge={selectedProvider === 'all'}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// File Row Component (List View)
interface FileRowProps {
  file: FileMetadata
  selected: boolean
  onSelect: () => void
  onFolderClick: (path: string) => void
  onOpen: (file: FileMetadata) => void
  onDownload: (file: FileMetadata) => void
  onShare: (file: FileMetadata) => void
  onRename: (file: FileMetadata) => void
  onMove: (file: FileMetadata) => void
  onCopy: (file: FileMetadata) => void
  onDelete: (file: FileMetadata) => void
  showProviderBadge?: boolean
}

function FileRow({ file, selected, onSelect, onFolderClick, onOpen, onDownload, onShare, onRename, onMove, onCopy, onDelete, showProviderBadge }: FileRowProps) {
  const provider = PROVIDERS.find(p => p.id === file.provider)

  const handleClick = () => {
    if (file.isFolder) {
      onFolderClick(file.path)
    }
  }

  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${file.isFolder ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center text-lg">
            {file.isFolder ? '📁' : getFileIcon(file.mimeType)}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
              {file.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
              {file.pathDisplay}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: provider?.color || '#888' }}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {(file as any).sourceLabel || file.providerName}
          </span>
          {showProviderBadge && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
              {file.provider.toUpperCase()}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {file.isFolder ? '—' : formatBytes(file.size)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {formatDate(file.modifiedTime)}
      </td>
      <td className="px-4 py-3 text-right">
        <FileActions
          file={file}
          onOpen={onOpen}
          onDownload={onDownload}
          onShare={onShare}
          onRename={onRename}
          onMove={onMove}
          onCopy={onCopy}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

// File Card Component (Grid View)
function FileCard({ file, selected, onSelect, onFolderClick, onOpen, onDownload, onShare, onRename, onMove, onCopy, onDelete, showProviderBadge }: FileRowProps) {
  const provider = PROVIDERS.find(p => p.id === file.provider)

  const handleClick = (e: React.MouseEvent) => {
    if (file.isFolder) {
      e.stopPropagation()
      onFolderClick(file.path)
    } else {
      onSelect()
    }
  }

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-blue-500' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
      }`}
      onClick={handleClick}
    >
      {selected && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}

      <div className="text-4xl mb-3 text-center">
        {file.isFolder ? '📁' : getFileIcon(file.mimeType)}
      </div>

      <p className="font-medium text-gray-900 dark:text-white text-sm truncate mb-1">
        {file.name}
      </p>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: provider?.color || '#888' }}
            />
            <span>{(file as any).sourceLabel || file.providerName}</span>
            {showProviderBadge && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                {file.provider.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>{file.isFolder ? '—' : formatBytes(file.size)}</span>
            <FileActions
            file={file}
            onOpen={onOpen}
            onDownload={onDownload}
            onShare={onShare}
            onRename={onRename}
            onMove={onMove}
            onCopy={onCopy}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  )
}

// File Actions Dropdown
interface FileActionsProps {
  file: FileMetadata
  onOpen: (file: FileMetadata) => void
  onDownload: (file: FileMetadata) => void
  onShare: (file: FileMetadata) => void
  onRename: (file: FileMetadata) => void
  onMove: (file: FileMetadata) => void
  onCopy: (file: FileMetadata) => void
  onDelete: (file: FileMetadata) => void
}

function ActionIcon({ title, onClick, paths }: { title: string; onClick: () => void; paths: string[] }) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
    >
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {paths.map((d, i) => (
          <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
        ))}
      </svg>
    </button>
  )
}

function FileActions({ file, onOpen, onDownload, onShare, onRename, onMove, onCopy, onDelete }: FileActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {/* Fluent-ish, familiar Windows line icons */}
      <ActionIcon
        title="Open/Preview"
        onClick={() => onOpen(file)}
        paths={[
          'M9 6h9a2 2 0 012 2v9',
          'M9 15H7a2 2 0 01-2-2V6a2 2 0 012-2h7',
          'M14 10l7-7',
          'M15 3h6v6',
        ]}
      />
      <ActionIcon
        title="Download"
        onClick={() => onDownload(file)}
        paths={[
          'M12 3v10',
          'M8 9l4 4 4-4',
          'M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
        ]}
      />
      <ActionIcon
        title="Rename"
        onClick={() => onRename(file)}
        paths={[
          'M4 20h4',
          'M14.5 6.5l3 3',
          'M7 17l9.5-9.5a2.12 2.12 0 010 0l.5-.5a2.12 2.12 0 013 3l-.5.5L10 20H7v-3z',
        ]}
      />
      <ActionIcon
        title="Move"
        onClick={() => onMove(file)}
        paths={[
          'M3 7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v2',
          'M13 14h8',
          'M18 11l3 3-3 3',
          'M3 11v8a2 2 0 002 2h8',
        ]}
      />
      <ActionIcon
        title="Copy"
        onClick={() => onCopy(file)}
        paths={[
          'M9 9h10v10H9z',
          'M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1',
        ]}
      />
      <ActionIcon
        title="Delete"
        onClick={() => onDelete(file)}
        paths={[
          'M6 7h12',
          'M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2',
          'M8 7l1 14h6l1-14',
          'M10 11v6',
          'M14 11v6',
        ]}
      />
    </div>
  )
}

// Helper Functions
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('gzip')) return '📦'
  if (mimeType.startsWith('text/')) return '📃'
  return '📄'
}

function formatDate(dateString: string): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  const ms = date.getTime()
  if (!Number.isFinite(ms)) return '—'

  const now = Date.now()
  const diff = now - ms
  if (!Number.isFinite(diff) || diff < 0) return date.toLocaleDateString()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

function dateMsSafe(dateString?: string | null): number {
  if (!dateString) return 0
  const ms = Date.parse(dateString)
  return Number.isFinite(ms) ? ms : 0
}

function providerLabel(file: FileMetadata): string {
  return ((file as any).sourceLabel || file.providerName || file.provider) as string
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
