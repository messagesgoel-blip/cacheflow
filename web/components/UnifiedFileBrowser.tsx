'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ProviderId, FileMetadata, PROVIDERS, formatBytes, ConnectedProvider } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import { transferFileBetweenProviders } from '@/lib/transfer/crossProvider'
import { tokenManager } from '@/lib/tokenManager'
import { metadataCache } from '@/lib/metadataCache'
import { actionLogger } from '@/lib/logger'
import { aggregateFiles, filterByProvider, type AggregatedFileItem } from '@/lib/fileAggregator'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useTransferQueue } from '@/components/TransferQueueProvider'
import TransferModal from '@/components/TransferModal'
import RenameModal from '@/components/RenameModal'
import Sidebar from '@/components/Sidebar'
import UnifiedBreadcrumb from '@/components/UnifiedBreadcrumb'
import SelectionToolbar from '@/components/SelectionToolbar'
import TransferQueuePanel from '@/components/TransferQueuePanel'
import PreviewPanel from '@/components/PreviewPanel'
import StarredView from '@/components/StarredView'
import ActivityFeed from '@/components/ActivityFeed'
import ShortcutHelp from '@/components/ShortcutHelp'
import apiClient, { type ProviderConnection } from '@/lib/apiClient'
import { isTextPreviewEligible, resolvePreviewType, type PreviewType } from '@/lib/files/previewUtils'
import { buildTextPreviewRequest, resolveDirectPreviewUrl } from '@/lib/files/previewSource'
import { markOnboardingMilestone } from '@/lib/ui/onboardingMilestones'

interface UnifiedFileBrowserProps {
  token: string
  routeView?: 'activity'
}

export default function UnifiedFileBrowser({ token, routeView }: UnifiedFileBrowserProps) {
  // Helpers to match requested structure
  const actions = useActionCenter()
  const showToast = (input: { title: string; message: string }) => actions.startTask({ ...input, progress: null })
  const dismissToast = (task: any) => task?.dismiss?.()
  const showErrorToast = (message: string) => actions.notify({ kind: 'error', title: 'Error', message, ttlMs: 5000 })

  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProviders, setLoadingProviders] = useState<ProviderId[]>([])
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'all' | 'recent' | 'starred' | 'activity'>('all')
  const [activeAccountKey, setActiveAccountKey] = useState<string>('')
  const [currentPath, setCurrentPath] = useState('/')
  const [breadcrumbStack, setBreadcrumbStack] = useState<Array<{ id: string; name: string }>>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isGroupedView, setIsGroupedView] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [isFavoriting, setIsFavoriting] = useState<Set<string>>(new Set())
  const [recentRenameBlocklist, setRecentRenameBlocklist] = useState<Map<string, string>>(new Map())
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [previewPanelFile, setPreviewPanelFile] = useState<{
    file: FileMetadata
    url: string | null
    type: PreviewType
    textContent?: string
    previewLoading?: boolean
    revokeUrlOnClose?: boolean
    previewError?: string
  } | null>(null)
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'move', file: FileMetadata } | null>(null)
  const [draggedFile, setDraggedFile] = useState<FileMetadata | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [showNewFileModal, setShowNewFileModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileTemplateId, setNewFileTemplateId] = useState<StarterFileTemplateId>('txt')
  const [creatingFile, setCreatingFile] = useState(false)
  const [creationTargetOverride, setCreationTargetOverride] = useState<CreationTargetOverride | null>(null)
  const [pendingFolderPath, setPendingFolderPath] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const filesRef = useRef<FileMetadata[]>([])
  const lastViewKeyRef = useRef<string | null>(null)

  // Aggregated mode state with persistence
  const [isAggregatedView, setIsAggregatedView] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cacheflow:aggregatedView') === 'true'
    }
    return false
  })
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cacheflow:duplicatesOnly') === 'true'
    }
    return false
  })
  const [aggregatedProviderFilter, setAggregatedProviderFilter] = useState<ProviderId | 'all' | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cacheflow:aggregatedProviderFilter')
      return stored ? stored as ProviderId | 'all' | null : null
    }
    return null
  })
  const [aggregatedFiles, setAggregatedFiles] = useState<AggregatedFileItem[]>([])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    if (loading) return
    if (error || pendingFolderPath === currentPath) {
      setPendingFolderPath(null)
    }
  }, [loading, error, pendingFolderPath, currentPath])

  // Persist aggregated view state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cacheflow:aggregatedView', isAggregatedView.toString())
    }
  }, [isAggregatedView])

  // Persist duplicates only state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cacheflow:duplicatesOnly', showDuplicatesOnly.toString())
    }
  }, [showDuplicatesOnly])

  // Persist aggregated provider filter state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cacheflow:aggregatedProviderFilter', aggregatedProviderFilter || '')
    }
  }, [aggregatedProviderFilter])
  
  const { addTransfer } = useTransferQueue()
  const [transferModal, setTransferModal] = useState<{ open: boolean; mode: 'copy' | 'move'; file: FileMetadata | null; correlationId?: string; initialFolderPath?: string }>({ open: false, mode: 'copy', file: null })
  const [renameModal, setRenameModal] = useState<{ open: boolean; file: FileMetadata | null; correlationId?: string }>({ open: false, file: null })

  const clearTransientBrowserState = useCallback(() => {
    setSelectedFiles(new Set())
    setFocusedIndex(-1)
    setPreviewPanelFile(null)
  }, [])

  const openActivityFeed = useCallback(() => {
    clearTransientBrowserState()
    setPendingFolderPath(null)
    setSelectedProvider('activity')
    setActiveAccountKey('')
    setCurrentPath('/')
    setBreadcrumbStack([])
    setRefreshKey((current) => current + 1)
  }, [clearTransientBrowserState])

  useEffect(() => {
    if (routeView === 'activity' && selectedProvider !== 'activity') {
      openActivityFeed()
    }
  }, [openActivityFeed, routeView, selectedProvider])

  // Selection computed
  const selectedFileObjects = useMemo(() => {
    return files.filter(f => selectedFiles.has(f.id))
  }, [files, selectedFiles])

  // Load favorites
  useEffect(() => {
    fetch('/api/favorites', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(res => res.json())
      .then(body => {
        if (body?.ok) {
          const items = Array.isArray(body.data?.favorites) ? body.data.favorites : []
          setFavorites(new Set(items.map((f: any) => f.file_id)))
        }
      })
      .catch(err => { console.warn('[UnifiedFileBrowser] Failed to fetch favorites:', err) })
  }, [token])

  // Load UI preferences
  useEffect(() => {
    if (localStorage.getItem('cacheflow:ui:sidebarCollapsed') === 'true') setIsSidebarCollapsed(true)
    if (localStorage.getItem('cacheflow:ui:allProvidersView') === 'flat') setIsGroupedView(false)
  }, [])

  useEffect(() => {
    const handleVpsFilesChanged = async (event: Event) => {
      const detail = (event as CustomEvent<{ connectionId?: string; folderPath?: string }>).detail
      const connectionId = detail?.connectionId
      if (!connectionId) return

      const folderPath = detail?.folderPath || '/'
      await metadataCache.invalidateCache('vps', connectionId, folderPath)

      const isCurrentVpsView =
        (selectedProvider === 'vps' && activeAccountKey === connectionId && currentPath === folderPath) ||
        (selectedProvider === 'all' && currentPath === folderPath)

      if (isCurrentVpsView) {
        setRefreshKey((k) => k + 1)
      }
    }

    window.addEventListener('cacheflow:vps-files-changed', handleVpsFilesChanged as EventListener)
    return () => {
      window.removeEventListener('cacheflow:vps-files-changed', handleVpsFilesChanged as EventListener)
    }
  }, [activeAccountKey, currentPath, selectedProvider])

  const toggleGroupedView = () => {
    const newState = !isGroupedView
    setIsGroupedView(newState); localStorage.setItem('cacheflow:ui:allProvidersView', newState ? 'grouped' : 'flat')
  }

  // Load connected providers from server state. Keep this separate from file refreshes;
  // navigation and folder refreshes should not rehydrate the entire connection model.
  useEffect(() => {
    let tokensChanged = false
    const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'vps', 'webdav']
    const maxAccountsPerProvider = 3
    const sortConnectionsForSync = (connections: ProviderConnection[]) =>
      [...connections].sort((a, b) => {
        const timeA = a.lastSyncAt ? new Date(a.lastSyncAt).getTime() : 0
        const timeB = b.lastSyncAt ? new Date(b.lastSyncAt).getTime() : 0
        return timeB - timeA || a.id.localeCompare(b.id)
      })
    const resolveAccountKey = (conn: ProviderConnection) =>
      conn.accountKey || conn.accountEmail || conn.accountName || conn.id

    if (tokenManager.getTokens('local').length > 0) {
      tokenManager.removeToken('local')
      tokensChanged = true
    }

    const loadConnections = async () => {
      let serverConnections: ProviderConnection[] = []
      let hasFreshServerState = false
      try {
        const result = await apiClient.getConnections()
        if (result.success && result.data) {
          serverConnections = result.data
          hasFreshServerState = true
        }
      } catch (err) {
        console.warn('[UnifiedFileBrowser] Failed to fetch server connections, using localStorage only:', err)
        setError('Failed to sync provider connections')
      }

      const connectionsForSync = sortConnectionsForSync(serverConnections)
      const desiredAccountsByProvider = new Map<ProviderId, Set<string>>()
      if (hasFreshServerState) {
        for (const pid of providerIds) {
          const desiredTokens = connectionsForSync
            .filter((conn) => conn.provider === pid)
            .slice(0, maxAccountsPerProvider)
            .map((conn) => ({
              accountKey: resolveAccountKey(conn),
              remoteId: conn.remoteId || conn.id,
            }))
          desiredAccountsByProvider.set(pid, new Set(desiredTokens.map((token) => token.accountKey)))

          const cachedTokens = tokenManager.getTokens(pid).filter((t) => !t.disabled)
          const shouldResetProviderTokens =
            desiredTokens.length !== cachedTokens.length ||
            desiredTokens.some((desired, index) => {
              const cached = cachedTokens[index]
              return !cached || cached.accountKey !== desired.accountKey || (cached as any).remoteId !== desired.remoteId
            })

          if (shouldResetProviderTokens && cachedTokens.length > 0) {
            tokenManager.removeToken(pid)
            tokensChanged = true
          }
        }
      }

      // Hydrate token manager from server-state remotes so seeded QA accounts appear after login.
      for (const conn of connectionsForSync) {
        const pid = conn.provider as ProviderId
        if (!providerIds.includes(pid)) continue
        const accountKey = resolveAccountKey(conn)
        if (hasFreshServerState && !desiredAccountsByProvider.get(pid)?.has(accountKey)) {
          continue
        }

        const remoteId = conn.remoteId || conn.id
        const existing = tokenManager.getTokens(pid).find(t => t.accountKey === accountKey)

        if (!existing || (!(existing as any).remoteId && remoteId)) {
          try {
            tokenManager.saveToken(
              pid,
              {
                provider: pid,
                accessToken: existing?.accessToken || '',
                accountEmail: conn.accountEmail || existing?.accountEmail || `${pid}@remote.local`,
                displayName: conn.accountLabel || existing?.displayName || conn.accountName || accountKey,
                accountId: (existing as any)?.accountId || accountKey,
                accountKey,
                expiresAt: existing?.expiresAt || null,
              } as any,
              remoteId
            )
            tokensChanged = true
          } catch (syncErr) {
            console.warn('[UnifiedFileBrowser] Failed to sync remote token:', pid, accountKey, syncErr)
          }
        }
      }

      // Build ConnectedProvider list: merge server metadata with localStorage tokens
      const connected: ConnectedProvider[] = []
      const loadingIds: ProviderId[] = []

      for (const pid of providerIds) {
        const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
        tokens.forEach((t, idx) => {
          if (t && (t.accessToken || (t as any).remoteId)) {
            const remoteId = (t as any).remoteId
            const serverConn = serverConnections.find(
              sc => sc.provider === pid && (
                (sc.accountKey && sc.accountKey === t.accountKey) ||
                (sc.remoteId && remoteId && sc.remoteId === remoteId) ||
                (!!sc.accountEmail && sc.accountEmail === t.accountEmail)
              )
            )

            // Map server status to local status (server uses "disconnected", local uses "needs_reauth")
            let status: 'connected' | 'error' | 'degraded' | 'needs_reauth' = 'connected'
            if (serverConn) {
              if (serverConn.status === 'error') status = 'error'
              else if (serverConn.status === 'disconnected') status = 'needs_reauth'
            }

            connected.push({
              providerId: pid,
              status,
              accountEmail: t.accountEmail || '',
              displayName: serverConn?.accountLabel || t.displayName || serverConn?.accountName || `${pid}-${idx + 1}`,
              accountKey: t.accountKey,
              host: serverConn?.host,
              port: serverConn?.port,
              username: serverConn?.username,
              connectedAt: serverConn?.lastSyncAt ? new Date(serverConn.lastSyncAt).getTime() : Date.now()
            })
            if (!loadingIds.includes(pid)) loadingIds.push(pid)
          }
        })
      }

      // FIX-06: Enforce stable sort by connectedAt or displayName
      connected.sort((a, b) => (a.connectedAt || 0) - (b.connectedAt || 0) || a.displayName.localeCompare(b.displayName))

      setConnectedProviders(connected)
      setLoadingProviders(loadingIds)
    }

    loadConnections()
  }, [token])
  const filteredFiles = useMemo(() => {
    if (!searchQuery || isSearching) return files
    const q = searchQuery.toLowerCase()
    return files.filter(f => f.name.toLowerCase().includes(q))
  }, [files, searchQuery, isSearching])

  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      let c = 0
      if (sortBy === 'name') c = a.name.localeCompare(b.name)
      else if (sortBy === 'date') c = dateMsSafe(a.modifiedTime) - dateMsSafe(b.modifiedTime)
      else if (sortBy === 'size') c = a.size - b.size
      return sortOrder === 'asc' ? c : -c
    })
  }, [filteredFiles, sortBy, sortOrder])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === '?') { setShowShortcutHelp(prev => !prev); return }
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        e.preventDefault(); document.querySelector<HTMLInputElement>('[data-testid="cf-global-search-input"]')?.focus(); return
      }
      if (e.key === 'Escape') { if (showShortcutHelp) setShowShortcutHelp(false); if (previewPanelFile) setPreviewPanelFile(null); return }
      
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => Math.min(prev + 1, sortedFiles.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => Math.max(prev - 1, 0)) }
      else if (e.key === 'Enter' && focusedIndex >= 0) { handleFileOpen(sortedFiles[focusedIndex]) }
      else if (e.key === 'Backspace' && currentPath !== '/') { handleBreadcrumbNavigate(breadcrumbStack.length - 2) }

      if (focusedIndex >= 0) {
        const file = sortedFiles[focusedIndex]
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') { setClipboard({ mode: 'copy', file }); actions.notify({ kind: 'info', title: 'Copied', message: file.name }) }
        else if ((e.ctrlKey || e.metaKey) && e.key === 'x') { setClipboard({ mode: 'move', file }); actions.notify({ kind: 'info', title: 'Cut', message: file.name }) } 
        if (e.key === 'Delete') handleFileDelete(file)
        if (e.key === 'F2') handleFileRename(file)
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        addTransfer({ type: clipboard.mode, file: clipboard.file, targetProviderId: selectedProvider === 'all' ? clipboard.file.provider : selectedProvider as ProviderId, targetAccountKey: activeAccountKey || (clipboard.file as any).accountKey, targetFolderId: currentPath === '/' ? rootFolderId(selectedProvider === 'all' ? clipboard.file.provider : selectedProvider as ProviderId) : currentPath })
        setClipboard(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedIndex, sortedFiles, clipboard, currentPath, breadcrumbStack, selectedProvider, activeAccountKey, showShortcutHelp, previewPanelFile])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleTransferComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ fileId?: string; type?: 'copy' | 'move' }>).detail
      setRefreshKey((k) => k + 1)

      if (!detail?.fileId) return

      setSelectedFiles((prev) => {
        if (!prev.has(detail.fileId!)) return prev
        const next = new Set(prev)
        next.delete(detail.fileId!)
        return next
      })

      setPreviewPanelFile((prev) => {
        if (!prev || prev.file.id !== detail.fileId) return prev
        return null
      })

      if (detail.type === 'move') {
        setFiles((prev) => prev.filter((item) => item.id !== detail.fileId))
      }
    }

    window.addEventListener('cacheflow:transfer-complete', handleTransferComplete)
    return () => {
      window.removeEventListener('cacheflow:transfer-complete', handleTransferComplete)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewPanelFile?.revokeUrlOnClose && previewPanelFile.url) {
        window.URL.revokeObjectURL(previewPanelFile.url)
      }
    }
  }, [previewPanelFile])

  // Fetch logic
  useEffect(() => {
    let isStale = false
    const viewKey = JSON.stringify({
      selectedProvider,
      activeAccountKey,
      currentPath,
      search: searchQuery.trim(),
      aggregated: isAggregatedView,
      duplicatesOnly: showDuplicatesOnly,
      aggregatedProviderFilter,
    })
    async function performSearch() {
      if (!searchQuery.trim()) return
      setIsSearching(true); setError(null)
      const allResults: FileMetadata[] = []
      const warnings: string[] = []
      const accountsToSearch = selectedProvider === 'all' ? connectedProviders : connectedProviders.filter(cp => cp.providerId === selectedProvider && (activeAccountKey ? cp.accountKey === activeAccountKey : true))

      await Promise.all(accountsToSearch.map(async (account) => {
        try {
          const provider = getProvider(account.providerId)
          if (!provider) return
          const tokens = tokenManager.getTokens(account.providerId)
          const tokenData = tokens.find(t => t.accountKey === account.accountKey)
          provider.remoteId = (tokenData as any)?.remoteId
          if (account.accountKey) tokenManager.setActiveToken(account.providerId, account.accountKey)
          const result = await provider.searchFiles({ query: searchQuery })
          if (isStale) return
          allResults.push(
            ...result.files.map((f) =>
              normalizeFileMetadata(
                {
                  ...f,
                  provider: account.providerId,
                  providerName: PROVIDERS.find((p) => p.id === account.providerId)?.name || account.providerId,
                  accountKey: account.accountKey,
                  sourceLabel: account.displayName,
                  remoteId: (tokenData as any).remoteId,
                } as any,
                { fallbackName: (f as any)?.name || (f as any)?.title || 'untitled' },
              ),
            ),
          )
        } catch (err: any) { warnings.push(`${account.displayName}: ${err.message}`) }
      }))
      if (isStale) return
      if (warnings.length > 0) setError(`Search partial failure: ${warnings.join(', ')}`)
      setFiles(allResults); setIsSearching(false); setLoading(false)
    }

    async function loadAllFiles() {
      if (searchQuery.trim()) { performSearch(); return }

      const preserveExistingFiles =
        lastViewKeyRef.current === viewKey && filesRef.current.length > 0
      lastViewKeyRef.current = viewKey

      if (!preserveExistingFiles) {
        clearTransientBrowserState()
        setFiles([])
        setAggregatedFiles([])
      }
      
      setLoading(true); 
      setError(null);

      const REFETCH_TIMEOUT = 8000;
      const timeoutId = setTimeout(() => {
        if (!isStale) {
          setLoading(false);
          actions.notify({ kind: 'warning', title: 'Still loading...', message: 'File list may be out of date — Refresh' });
        }
      }, REFETCH_TIMEOUT);

      if (['recent', 'starred', 'activity'].includes(selectedProvider)) { 
        clearTimeout(timeoutId);
        setLoading(false); 
        return; 
      }

      // Use aggregated mode when viewing all providers
      if (isAggregatedView && selectedProvider === 'all') {
        try {
          // Build provider instances for aggregator
          const providerInstances = connectedProviders.map(account => {
            const provider = getProvider(account.providerId)
            const tokens = tokenManager.getTokens(account.providerId)
            const tokenData = tokens.find(t => t.accountKey === account.accountKey)
            if (provider && tokenData && account.accountKey) {
              provider.remoteId = (tokenData as any)?.remoteId
              tokenManager.setActiveToken(account.providerId, account.accountKey)
            }
            return {
              providerId: account.providerId,
              listFiles: async (options?: { folderId?: string }) => {
                if (!provider) return []
                const folderId = options?.folderId === '/' ? rootFolderId(account.providerId) : (options?.folderId || rootFolderId(account.providerId))
                const result = await provider.listFiles({ folderId })
                return result.files.map((f) =>
                  normalizeFileMetadata(
                    {
                      ...f,
                      provider: account.providerId,
                      providerName: PROVIDERS.find((p) => p.id === account.providerId)?.name || account.providerId,
                      accountKey: account.accountKey,
                      sourceLabel: account.displayName,
                      remoteId: (tokenData as any)?.remoteId,
                    } as FileMetadata,
                    { fallbackName: (f as any)?.name || (f as any)?.title || 'untitled' },
                  ),
                )
              }
            }
          })

          // Call aggregator
          const folderId = currentPath === '/' ? undefined : currentPath
          const { files: aggregated, errors } = await aggregateFiles(providerInstances, folderId, {
            detectDuplicates: true
          })

          if (isStale) return

          // Report any provider errors to the user
          if (errors.length > 0) {
            const errorMessages = errors.map(err => `${err.providerId}: ${err.error}`).join(', ')
            setError(`Partial success: ${errorMessages}`)
          }

          // Apply aggregated provider filter if in aggregated mode
          let filtered = aggregated
          if (aggregatedProviderFilter && aggregatedProviderFilter !== 'all') {
            filtered = filterByProvider(aggregated, aggregatedProviderFilter)
          }

          // Show duplicates only if toggled
          if (showDuplicatesOnly) {
            filtered = filtered.filter(f => f.isDuplicate)
          }

          setAggregatedFiles(filtered)
          // Convert back to FileMetadata for compatibility with existing UI
          const converted = filtered.map((f) =>
            normalizeFileMetadata(
              {
                ...f,
                isDuplicate: f.isDuplicate,
                providers: f.providers,
              } as FileMetadata & { isDuplicate?: boolean; providers?: ProviderId[] },
              { fallbackName: f.name || 'untitled' },
            ),
          )
          setFiles(converted)
          setSelectedFiles(new Set())
        } catch (err: any) {
          if (!isStale) {
            setError(`Aggregation failed: ${err.message}`)
          }
        } finally {
          clearTimeout(timeoutId)
          if (!isStale) setLoading(false)
        }
        return
      }

      // Standard single-provider or non-aggregated mode
      try {
        const allFiles: FileMetadata[] = []
        const errors: string[] = []
        const pids = selectedProvider === 'all' ? loadingProviders : [selectedProvider as ProviderId]

        for (const pid of pids) {
          if (isStale) break
          const tokens = selectedProvider === 'all' ? tokenManager.getTokens(pid).filter(t => !t.disabled) : [tokenManager.getToken(pid, activeAccountKey)]
          for (const t of tokens) {
            if (!t || isStale) continue
            const provider = getProvider(pid); if (!provider) continue
            const key = t.accountKey || t.accountEmail || ''; if (key) tokenManager.setActiveToken(pid, key)
            provider.remoteId = (t as any).remoteId
            const folderId = currentPath === '/' ? rootFolderId(pid) : currentPath
            let resultFiles: FileMetadata[] = []
            const cached = await metadataCache.getCachedFiles(pid, key, folderId)
            if (cached) resultFiles = cached
            else {
              try { const result = await provider.listFiles({ folderId }); resultFiles = result.files; await metadataCache.cacheFiles(pid, key, folderId, resultFiles) }
              catch (err: any) { errors.push(`${pid}: ${err.message}`); continue }
            }
            if (isStale) break
            allFiles.push(
              ...resultFiles.map((file) =>
                normalizeFileMetadata(
                  {
                    ...file,
                    provider: pid,
                    providerName: PROVIDERS.find((p) => p.id === pid)?.name || pid,
                    accountKey: key,
                    sourceLabel: (t as any).displayName || (t as any).accountEmail || pid,
                    remoteId: (t as any).remoteId,
                  } as any,
                  { fallbackName: (file as any)?.name || (file as any)?.title || 'untitled' },
                ),
              ),
            )
          }
        }
        if (isStale) return
        if (errors.length > 0) setError(`Failed to load: ${errors.join(', ')}`)
        
        // FIX-03: Robust ghost row prevention - only block the OLD name for this ID
        const filteredFromRenames = allFiles.filter(f => {
          const blockedName = recentRenameBlocklist.get(f.id);
          return blockedName !== f.name;
        });
        
        setFiles(filteredFromRenames); 
        setSelectedFiles(new Set())
      } catch (err: any) {
        if (!isStale) setError(`Load failed: ${err.message}`)
      } finally {
        clearTimeout(timeoutId)
        if (!isStale) setLoading(false)
      }
    }
    const timer = setTimeout(() => { if (searchQuery.trim()) performSearch(); else loadAllFiles() }, searchQuery.trim() ? 500 : 0)
    return () => { isStale = true; clearTimeout(timer) }
  }, [selectedProvider, activeAccountKey, currentPath, refreshKey, loadingProviders, searchQuery, connectedProviders, isAggregatedView, showDuplicatesOnly, aggregatedProviderFilter, clearTransientBrowserState])

  // Handlers
  const handleSidebarNavigate = (pid: any, key?: string) => {
    clearTransientBrowserState()
    setPendingFolderPath(null)
    setSelectedProvider(pid)
    if (key) {
      setActiveAccountKey(key)
      tokenManager.setActiveToken(pid, key)
    } else {
      setActiveAccountKey('')
    }
    setCurrentPath('/')
    setBreadcrumbStack([])
    setRefreshKey(k => k + 1)
  }
  const handleBreadcrumbNavigate = (idx: number) => {
    clearTransientBrowserState()
    setPendingFolderPath(null)
    if (idx === -1) {
      setCurrentPath('/')
      setBreadcrumbStack([])
    } else {
      const target = breadcrumbStack[idx]
      setCurrentPath(target.id)
      setBreadcrumbStack(prev => prev.slice(0, idx + 1))
    }
  }
  const handleFolderClick = (file: FileMetadata) => {
    clearTransientBrowserState()
    const nextPath = getFolderNavigationTarget(file)
    if (loading || pendingFolderPath === nextPath || currentPath === nextPath) return
    setPendingFolderPath(nextPath)
    if (selectedProvider === 'all') {
      setSelectedProvider(file.provider as any)
      if ((file as any).accountKey) {
        setActiveAccountKey((file as any).accountKey)
        tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      }
    }
    setCurrentPath(nextPath)
    setBreadcrumbStack(buildNextBreadcrumbStack(breadcrumbStack, file, nextPath))
  }
  
  const handleToggleFavorite = async (file: FileMetadata) => {
    if (isFavoriting.has(file.id)) return
    setIsFavoriting(prev => new Set(prev).add(file.id))
    
    const isFav = favorites.has(file.id); const method = isFav ? 'DELETE' : 'POST'
    const url = isFav ? `/api/favorites/${file.id}?provider=${file.provider}&accountKey=${(file as any).accountKey}` : '/api/favorites'
    try {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: isFav ? undefined : JSON.stringify({ provider: file.provider, accountKey: (file as any).accountKey, fileId: file.id, fileName: file.name, mimeType: file.mimeType, isFolder: file.isFolder, path: file.path }),
      })
      const body = await res.json(); 
      if (body.ok) {
        setFavorites(prev => { const n = new Set(prev); if (isFav) n.delete(file.id); else n.add(file.id); return n })
      }
    } catch (err) { console.error(err) }
    finally {
      setIsFavoriting(prev => { const n = new Set(prev); n.delete(file.id); return n })
    }
  }

  const handleFileDownload = async (file: FileMetadata) => {
    const safeName = file.name || 'untitled'
    
    // FIX-01: No key, 5s safety
    const task = actions.startTask({ title: 'Downloading', message: safeName, progress: null })
    const safetyTimer = setTimeout(() => task.dismiss(), 5000)
    
    try {
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider); if (!provider) throw new Error('Provider not available')
      provider.remoteId = (file as any).remoteId
      const blob = await provider.downloadFile(file.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = safeName
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      const message = err?.message || 'Download failed'
      actions.notify({ kind: 'error', title: 'Download failed', message, ttlMs: 5000 })
    } finally {
      clearTimeout(safetyTimer)
      task.dismiss()
    }
  }

  const handleFileOpen = async (file: FileMetadata) => {
    if (file.isFolder) { handleFolderClick(file); return }
    const safeName = file.name || 'untitled'
    const normalizedFile = normalizeFileMetadata(file, { fallbackName: safeName })
    const type = resolvePreviewType({ mimeType: file.mimeType, fileName: safeName })
    const isInlinePreview = isTextPreviewEligible({ size: file.size }) || type === 'image'
    
    // FIX-01: Exact deviation-free structure
    const toastId = showToast({ title: isInlinePreview ? "Previewing" : "Opening", message: safeName });
    const safety = setTimeout(() => dismissToast(toastId), 5000);
    
    try {
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider); if (!provider) throw new Error('Provider not available')
      provider.remoteId = (file as any).remoteId

      if (type === 'pdf' || type === 'other') {
        setPreviewPanelFile({
          file: normalizedFile,
          url: null,
          type,
          previewLoading: false,
        })
        clearTimeout(safety);
        dismissToast(toastId);
        return
      }

      if (type === 'image') {
        const directUrl = resolveDirectPreviewUrl(normalizedFile, activeAccountKey)
        if (directUrl) {
          setPreviewPanelFile({
            file: normalizedFile,
            url: directUrl,
            type,
            previewLoading: false,
            revokeUrlOnClose: false,
          })
          clearTimeout(safety);
          dismissToast(toastId);
          return
        }

        setPreviewPanelFile({
          file: normalizedFile,
          url: null,
          type,
          previewLoading: true,
        })

        const blob = await provider.downloadFile(file.id)
        const objectUrl = window.URL.createObjectURL(blob)
        setPreviewPanelFile((prev) => {
          if (!prev || prev.file.id !== normalizedFile.id) {
            window.URL.revokeObjectURL(objectUrl)
            return prev
          }

          if (prev.revokeUrlOnClose && prev.url) {
            window.URL.revokeObjectURL(prev.url)
          }

          return {
            ...prev,
            url: objectUrl,
            previewLoading: false,
            revokeUrlOnClose: true,
          }
        })
        clearTimeout(safety);
        dismissToast(toastId);
        return
      }

      setPreviewPanelFile({
        file: normalizedFile,
        url: null,
        type,
        previewLoading: true,
      })

      let textContent: string | undefined
      if (type === 'text' && isTextPreviewEligible({ size: file.size })) {
        const previewRequest = buildTextPreviewRequest(normalizedFile, {
          token,
          fallbackAccountKey: activeAccountKey,
        })

        if (previewRequest) {
          const response = await fetch(previewRequest.url, previewRequest.init)
          if (!response.ok) {
            throw new Error(`Preview failed: ${response.statusText}`)
          }
          textContent = await response.text()
        } else {
          const blob = await provider.downloadFile(file.id)
          textContent = await blob.text()
        }
      }

      setPreviewPanelFile((prev) => {
        if (!prev || prev.file.id !== normalizedFile.id) return prev
        return {
          ...prev,
          textContent,
          previewLoading: false,
        }
      })
      
      clearTimeout(safety);
      dismissToast(toastId);
    } catch (err: any) {
      clearTimeout(safety);
      dismissToast(toastId);
      showErrorToast(err?.status === 404
        ? "File not found — it may have been deleted"
        : err?.message ?? "Preview failed");
        
      setPreviewPanelFile({
        file: normalizedFile,
        url: null,
        type,
        previewLoading: false,
        previewError: err?.message || 'Could not load preview',
      })
    }
  }

  const handleFileMove = (file: FileMetadata) => setTransferModal({ open: true, mode: 'move', file, initialFolderPath: currentTransferFolderPath })
  const handleFileCopy = (file: FileMetadata) => setTransferModal({ open: true, mode: 'copy', file, initialFolderPath: currentTransferFolderPath })
  const handleFileRename = (file: FileMetadata) => {
    const correlationId = actionLogger.generateCorrelationId()
    actionLogger.log({
      event: 'modal_open',
      actionName: 'rename',
      providerId: file.provider,
      fileId: file.id,
      currentPath,
      correlationId,
    })
    setRenameModal({ open: true, file, correlationId })
  }
  const resolveUploadTarget = useCallback((): { providerId: ProviderId; accountKey: string } | null => {
    const isProviderScoped = !['all', 'recent', 'starred', 'activity'].includes(selectedProvider)
    if (isProviderScoped) {
      const pid = selectedProvider as ProviderId
      const scopedAccount = connectedProviders.find(
        (cp) => cp.providerId === pid && (!activeAccountKey || cp.accountKey === activeAccountKey),
      ) || connectedProviders.find((cp) => cp.providerId === pid)
      if (!scopedAccount) return null
      return { providerId: pid, accountKey: scopedAccount.accountKey || '' }
    }

    if (activeAccountKey) {
      const active = connectedProviders.find((cp) => cp.accountKey === activeAccountKey)
      if (active) return { providerId: active.providerId, accountKey: active.accountKey || '' }
    }

    const fallback = connectedProviders[0]
    return fallback ? { providerId: fallback.providerId, accountKey: fallback.accountKey || '' } : null
  }, [selectedProvider, activeAccountKey, connectedProviders])

  const writableTarget = useMemo(() => resolveUploadTarget(), [resolveUploadTarget])
  const writeActionsDisabled = useMemo(
    () => ['recent', 'starred', 'activity'].includes(selectedProvider) || !writableTarget,
    [selectedProvider, writableTarget],
  )
  const writeTargetLabel = useMemo(() => {
    if (!writableTarget) return 'No writable provider selected'
    const account = connectedProviders.find(
      (cp) => cp.providerId === writableTarget.providerId && cp.accountKey === writableTarget.accountKey,
    )
    const providerName =
      PROVIDERS.find((provider) => provider.id === writableTarget.providerId)?.name || writableTarget.providerId
    return account?.displayName ? `${providerName} · ${account.displayName}` : providerName
  }, [connectedProviders, writableTarget])

  const getCurrentFolderIdForProvider = useCallback(
    (providerId: ProviderId) => (currentPath === '/' ? rootFolderId(providerId) : currentPath),
    [currentPath],
  )

  const resolvedCreationTarget = useMemo(() => {
    if (creationTargetOverride) return creationTargetOverride
    if (!writableTarget) return null
    return {
      providerId: writableTarget.providerId,
      accountKey: writableTarget.accountKey,
      folderId: getCurrentFolderIdForProvider(writableTarget.providerId),
      pathLabel: currentPath,
      targetLabel: writeTargetLabel,
    }
  }, [creationTargetOverride, currentPath, getCurrentFolderIdForProvider, writableTarget, writeTargetLabel])

  const emitVpsFilesChanged = useCallback(
    (target: { providerId: ProviderId; accountKey: string }, folderPath: string) => {
      if (target.providerId !== 'vps' || typeof window === 'undefined' || !target.accountKey) return
      window.dispatchEvent(
        new CustomEvent('cacheflow:vps-files-changed', {
          detail: {
            connectionId: target.accountKey,
            folderPath,
          },
        }),
      )
    },
    [],
  )

  const closeNewFolderModal = useCallback(() => {
    if (creatingFolder) return
    setShowNewFolderModal(false)
    setNewFolderName('')
    setCreationTargetOverride(null)
  }, [creatingFolder])

  const closeNewFileModal = useCallback(() => {
    if (creatingFile) return
    setShowNewFileModal(false)
    setNewFileName('')
    setNewFileTemplateId('txt')
    setCreationTargetOverride(null)
  }, [creatingFile])

  const openNewFolderModal = useCallback(() => {
    if (writeActionsDisabled) {
      actions.notify({
        kind: 'info',
        title: 'Select a writable drive',
        message: 'New folders can only be created inside a connected provider scope.',
      })
      return
    }
    setCreationTargetOverride(null)
    setShowNewFolderModal(true)
  }, [actions, writeActionsDisabled])

  const openNewFileModal = useCallback(() => {
    if (writeActionsDisabled) {
      actions.notify({
        kind: 'info',
        title: 'Select a writable drive',
        message: 'Starter files can only be created inside a connected provider scope.',
      })
      return
    }
    setCreationTargetOverride(null)
    setShowNewFileModal(true)
  }, [actions, writeActionsDisabled])

  useEffect(() => {
    const handleCommandUpload = () => {
      if (connectedProviders.length === 0) {
        actions.notify({
          kind: 'info',
          title: 'No connected provider',
          message: 'Connect a provider before uploading files.',
        })
        return
      }
      uploadInputRef.current?.click()
    }

    window.addEventListener('cacheflow:command-upload', handleCommandUpload)
    window.addEventListener('cacheflow:command-new-folder', openNewFolderModal)
    window.addEventListener('cacheflow:command-new-file', openNewFileModal)
    window.addEventListener('cacheflow:command-open-activity', openActivityFeed)

    return () => {
      window.removeEventListener('cacheflow:command-upload', handleCommandUpload)
      window.removeEventListener('cacheflow:command-new-folder', openNewFolderModal)
      window.removeEventListener('cacheflow:command-new-file', openNewFileModal)
      window.removeEventListener('cacheflow:command-open-activity', openActivityFeed)
    }
  }, [actions, connectedProviders.length, openActivityFeed, openNewFileModal, openNewFolderModal])

  const openCreateInsideFolder = useCallback(
    (folder: FileMetadata, kind: 'folder' | 'file') => {
      if (!folder.isFolder) return
      setCreationTargetOverride({
        providerId: folder.provider,
        accountKey: (folder as any).accountKey || '',
        folderId: getFolderNavigationTarget(folder),
        pathLabel: String(folder.path || folder.id),
        targetLabel: `${providerLabel(folder)} · ${folder.name || '[unnamed folder]'}`,
      })
      if (kind === 'folder') {
        setShowNewFolderModal(true)
      } else {
        setShowNewFileModal(true)
      }
    },
    [],
  )

  const handleUploadSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = Array.from(e.target.files || [])
    if (filesToUpload.length === 0) return

    const target = resolveUploadTarget()
    if (!target) {
      actions.notify({
        kind: 'error',
        title: 'Upload failed',
        message: 'No connected provider is available for upload.',
      })
      e.target.value = ''
      return
    }

    const provider = getProvider(target.providerId)
    if (!provider) {
      actions.notify({
        kind: 'error',
        title: 'Upload failed',
        message: `Provider ${target.providerId} is not available.`,
      })
      e.target.value = ''
      return
    }

    if (target.accountKey) {
      tokenManager.setActiveToken(target.providerId, target.accountKey)
    }
    const tokenData = tokenManager.getToken(target.providerId, target.accountKey)
    provider.remoteId = (tokenData as any)?.remoteId

    const folderId = currentPath === '/' ? rootFolderId(target.providerId) : currentPath
    const task = actions.startTask({
      key: 'file-action',
      title: 'Uploading',
      message: `${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}`,
      progress: null,
    })

    setUploading(true)
    try {
      const uploadedFiles: FileMetadata[] = []
      for (const file of filesToUpload) {
        const uploaded = await provider.uploadFile(file, { folderId })
        uploadedFiles.push(
          normalizeFileMetadata(
            {
              ...uploaded,
              provider: target.providerId,
              providerName: PROVIDERS.find((p) => p.id === target.providerId)?.name || target.providerId,
              accountKey: target.accountKey,
              sourceLabel: tokenData?.displayName || tokenData?.accountEmail || target.providerId,
              remoteId: (tokenData as any)?.remoteId,
            } as any,
            { fallbackName: file.name },
          ),
        )
      }
      if (uploadedFiles.length > 0) {
        setFiles((prev) => {
          const byId = new Map<string, FileMetadata>()
          uploadedFiles.forEach((item) => byId.set(item.id, item))
          prev.forEach((item) => {
            if (!byId.has(item.id)) byId.set(item.id, item)
          })
          return Array.from(byId.values())
        })
      }
      await metadataCache.invalidateCache(target.providerId, target.accountKey)
      setRefreshKey((k) => k + 1)
      markOnboardingMilestone('uploadCompleted')
      task.succeed(`${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}`)
    } catch (err: any) {
      task.fail(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRefresh = async () => {
    const folderIdForCache = currentPath === '/' ? null : currentPath

    if (selectedProvider === 'all') {
      await Promise.allSettled(
        connectedProviders.map((cp) =>
          metadataCache.invalidateCache(
            cp.providerId,
            cp.accountKey || undefined,
            folderIdForCache ?? rootFolderId(cp.providerId),
          ),
        ),
      )
      setRefreshKey((k) => k + 1)
      return
    }

    if (['recent', 'starred', 'activity'].includes(selectedProvider)) {
      setRefreshKey((k) => k + 1)
      return
    }

    const pid = selectedProvider as ProviderId
    if (activeAccountKey) {
      await metadataCache.invalidateCache(
        pid,
        activeAccountKey,
        folderIdForCache ?? rootFolderId(pid),
      )
    } else {
      await metadataCache.invalidateCache(pid)
    }
    setRefreshKey((k) => k + 1)
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) {
      actions.notify({
        kind: 'error',
        title: 'Folder name required',
        message: 'Enter a folder name before creating it.',
      })
      return
    }

    const target = resolvedCreationTarget
    if (!target) {
      actions.notify({
        kind: 'error',
        title: 'Create folder failed',
        message: 'No connected provider is available for this action.',
      })
      return
    }

    const provider = getProvider(target.providerId)
    if (!provider) {
      actions.notify({
        kind: 'error',
        title: 'Create folder failed',
        message: `Provider ${target.providerId} is not available.`,
      })
      return
    }

    if (target.accountKey) {
      tokenManager.setActiveToken(target.providerId, target.accountKey)
    }
    const tokenData = tokenManager.getToken(target.providerId, target.accountKey)
    provider.remoteId = (tokenData as any)?.remoteId

    const folderId = target.folderId
    const task = actions.startTask({
      title: 'Creating folder',
      message: name,
      progress: null,
    })

    setCreatingFolder(true)
    try {
      await provider.createFolder(name, folderId)
      await metadataCache.invalidateCache(target.providerId, target.accountKey || undefined, folderId)
      emitVpsFilesChanged(target, target.pathLabel)
      setRefreshKey((k) => k + 1)
      task.succeed(name)
      closeNewFolderModal()
    } catch (err: any) {
      task.fail(err?.message || 'Create folder failed')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleCreateStarterFile = async () => {
    const target = resolvedCreationTarget
    if (!target) {
      actions.notify({
        kind: 'error',
        title: 'Create file failed',
        message: 'No connected provider is available for this action.',
      })
      return
    }

    const template = getStarterFileTemplate(newFileTemplateId)
    const fileName = buildStarterFileName(newFileName, template.id)
    if (!fileName) {
      actions.notify({
        kind: 'error',
        title: 'File name required',
        message: 'Enter a file name before creating it.',
      })
      return
    }

    const provider = getProvider(target.providerId)
    if (!provider) {
      actions.notify({
        kind: 'error',
        title: 'Create file failed',
        message: `Provider ${target.providerId} is not available.`,
      })
      return
    }

    if (target.accountKey) {
      tokenManager.setActiveToken(target.providerId, target.accountKey)
    }
    const tokenData = tokenManager.getToken(target.providerId, target.accountKey)
    provider.remoteId = (tokenData as any)?.remoteId

    const folderId = target.folderId
    const task = actions.startTask({
      title: 'Creating file',
      message: fileName,
      progress: null,
    })

    setCreatingFile(true)
    try {
      const file = new File([buildStarterFileContent(template.id)], fileName, {
        type: template.mimeType,
      })
      await provider.uploadFile(file, { folderId })
      await metadataCache.invalidateCache(target.providerId, target.accountKey || undefined, folderId)
      emitVpsFilesChanged(target, target.pathLabel)
      setRefreshKey((k) => k + 1)
      task.succeed(fileName)
      closeNewFileModal()
    } catch (err: any) {
      task.fail(err?.message || 'Create file failed')
    } finally {
      setCreatingFile(false)
    }
  }

  const handleFileDelete = async (file: FileMetadata) => {
    const safeName = file.name || 'untitled'
    const ok = await actions.confirm({ title: 'Delete?', message: `Delete "${safeName}"?`, confirmText: 'Delete', cancelText: 'Cancel' })
    if (!ok) return

    const toastId = showToast({ title: "Deleting", message: safeName });
    const safety = setTimeout(() => dismissToast(toastId), 5000);
    
    // Optimistic removal
    const previousFiles = [...files]
    setFiles((prev) => prev.filter((item) => item.id !== file.id))
    setAggregatedFiles((prev) => prev.filter((item) => item.id !== file.id))
    setPreviewPanelFile((prev) => (prev?.file?.id === file.id ? null : prev))
    setSelectedFiles(prev => {
      const next = new Set(prev)
      next.delete(file.id)
      return next
    })

    try {
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider)
      if (!provider) throw new Error('Provider not found')
      provider.remoteId = (file as any).remoteId
      await provider.deleteFile(file.id)
      await metadataCache.invalidateCache(file.provider as any, (file as any).accountKey)
      
      clearTimeout(safety);
      dismissToast(toastId);
      
      // Refresh without clearing the list
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      clearTimeout(safety);
      dismissToast(toastId);
      setFiles(previousFiles) // Restore on failure
      showErrorToast("Delete failed: " + err.message);
    }
  }

  const groupedFiles = useMemo(() => {
    if (!isGroupedView || selectedProvider !== 'all' || searchQuery.trim()) return null
    const groups: Record<string, { label: string, providerId: ProviderId, accountKey: string, files: FileMetadata[] }> = {}
    sortedFiles.forEach(f => {
      const key = `${f.provider}:${(f as any).accountKey || 'default'}`
      if (!groups[key]) groups[key] = { label: providerLabel(f), providerId: f.provider as ProviderId, accountKey: (f as any).accountKey, files: [] }
      groups[key].files.push(f)
    })
    return Object.values(groups)
  }, [sortedFiles, isGroupedView, selectedProvider, searchQuery])

  const activeAccountName = useMemo(() => {
    if (['all', 'recent', 'starred', 'activity'].includes(selectedProvider) || !activeAccountKey) return undefined
    return connectedProviders.find(cp => cp.providerId === selectedProvider && cp.accountKey === activeAccountKey)?.displayName
  }, [selectedProvider, activeAccountKey, connectedProviders])
  const currentTransferFolderPath = useMemo(() => {
    return breadcrumbStack[breadcrumbStack.length - 1]?.id || currentPath
  }, [breadcrumbStack, currentPath])
  const visibleFolderCount = useMemo(() => sortedFiles.filter((file) => file.isFolder).length, [sortedFiles])
  const visibleFileCount = useMemo(() => sortedFiles.filter((file) => !file.isFolder).length, [sortedFiles])
  const visibleProviderCount = useMemo(
    () => new Set(sortedFiles.map((file) => `${file.provider}:${(file as any).accountKey || 'default'}`)).size,
    [sortedFiles],
  )
  const currentScopeLabel = useMemo(() => {
    if (selectedProvider === 'all') return isAggregatedView ? 'Cross-provider index' : 'All providers'
    if (selectedProvider === 'recent') return 'Recent'
    if (selectedProvider === 'starred') return 'Starred'
    if (selectedProvider === 'activity') return 'Activity'
    return activeAccountName
      ? `${PROVIDERS.find((provider) => provider.id === selectedProvider)?.name || selectedProvider} · ${activeAccountName}`
      : PROVIDERS.find((provider) => provider.id === selectedProvider)?.name || selectedProvider
  }, [activeAccountName, isAggregatedView, selectedProvider])
  const quickStats = useMemo(
    () => [
      { label: 'Scope', value: currentScopeLabel, accent: 'text-[var(--cf-blue)]', helper: breadcrumbStack.length > 0 ? `Depth ${breadcrumbStack.length}` : 'Root view' },
      { label: 'Folders', value: visibleFolderCount.toString(), accent: 'text-[var(--cf-teal)]', helper: `${visibleFileCount} files in current view` },
      { label: 'Providers', value: visibleProviderCount.toString(), accent: 'text-[var(--cf-amber)]', helper: activeAccountKey ? 'Account scoped' : 'Shared surface' },
      { label: 'Selection', value: selectedFiles.size.toString(), accent: 'text-[var(--cf-purple)]', helper: selectedFiles.size > 0 ? 'Actions unlocked' : 'No files selected' },
    ],
    [activeAccountKey, breadcrumbStack.length, currentScopeLabel, selectedFiles.size, visibleFileCount, visibleFolderCount, visibleProviderCount],
  )

  return (
    <div className="cf-liquid cf-shell-browser flex h-[calc(100vh-132px)] gap-3 overflow-hidden rounded-[36px] p-3 shadow-[var(--cf-shadow-strong)]">
      <Sidebar connectedProviders={connectedProviders} selectedProvider={selectedProvider} activeAccountKey={activeAccountKey} onNavigate={handleSidebarNavigate} onDrop={(e, pid, key, fid) => {
        e.preventDefault(); const d = e.dataTransfer.getData('application/cacheflow-file'); if (!d) return
        const f = JSON.parse(d); const mode = (f.provider === pid && f.accountKey === key) ? 'move' : 'copy'
        addTransfer({ type: mode, file: f, targetProviderId: pid, targetAccountKey: key, targetFolderId: fid })
      }} />
      <main className="cf-liquid cf-shell-main relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] bg-[var(--cf-shell-card-strong)]">
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUploadSelection}
          data-testid="cf-action-upload-input"
        />
        {transferModal.open && transferModal.file && <TransferModal isOpen={transferModal.open} mode={transferModal.mode} file={transferModal.file} currentFolderPath={transferModal.initialFolderPath || currentTransferFolderPath} connectedProviderIds={Array.from(new Set(connectedProviders.map(cp => cp.providerId)))} onClose={() => setTransferModal({ open: false, mode: 'copy', file: null })} onSubmit={async (args) => { addTransfer({ type: transferModal.mode, file: transferModal.file!, ...args }); setTransferModal({ open: false, mode: 'copy', file: null }); setSelectedFiles(new Set()) }} />}
        {renameModal.open && renameModal.file && <RenameModal isOpen={renameModal.open} title="Rename" initialValue={renameModal.file?.name || ''} onClose={() => {
          if (renameModal.file && renameModal.correlationId) {
            actionLogger.log({
              event: 'modal_close',
              actionName: 'rename',
              providerId: renameModal.file.provider,
              fileId: renameModal.file.id,
              currentPath,
              correlationId: renameModal.correlationId,
            })
          }
          setRenameModal({ open: false, file: null })
        }} onSubmit={async (newName) => {
          const f = renameModal.file!
          const p = getProvider(f.provider)!
          const correlationId = renameModal.correlationId || actionLogger.generateCorrelationId()
          p.remoteId = (f as any).remoteId
          p.setRequestCorrelationId(correlationId)
          const oldName = f.name

          actionLogger.log({
            event: 'action_start',
            actionName: 'rename',
            providerId: f.provider,
            fileId: f.id,
            currentPath,
            correlationId,
          })
          
          const toastId = showToast({ title: "Renaming", message: oldName || "file" });
          const safety = setTimeout(() => dismissToast(toastId), 5000);
          
          // FIX-03: Remove old row immediately to prevent ghost row
          setFiles(prev => prev.filter(item => item.id !== f.id));
          setAggregatedFiles(prev => prev.filter(item => item.id !== f.id));
          
          // FIX-03: Track this ID as renamed with its OLD name to hide stale entries
          setRecentRenameBlocklist(prev => {
            const next = new Map(prev);
            next.set(f.id, oldName);
            return next;
          });
          // Clear block after 10s
          setTimeout(() => {
            setRecentRenameBlocklist(prev => {
              const next = new Map(prev);
              next.delete(f.id);
              return next;
            });
          }, 10000);

          try {
            // FIX-04: Update detail panel immediately
            const renamedFile = applyRenamedMetadata(f, newName)
            setPreviewPanelFile(prev => prev?.file?.id === f.id ? { ...prev, file: renamedFile } : prev);

            await p.renameFile(f.id, newName)
            await metadataCache.invalidateCache(f.provider as any, (f as any).accountKey)
            
            clearTimeout(safety);
            dismissToast(toastId);

            actionLogger.log({
              event: 'action_success',
              actionName: 'rename',
              providerId: f.provider,
              fileId: f.id,
              currentPath,
              correlationId,
            })
            
            // Trigger server refetch
            setRefreshKey(k => k + 1);
          } catch (err: any) {
            clearTimeout(safety);
            dismissToast(toastId);
            showErrorToast("Rename failed: " + err.message);

            actionLogger.log({
              event: 'action_fail',
              actionName: 'rename',
              providerId: f.provider,
              fileId: f.id,
              currentPath,
              correlationId,
              error: err?.message || 'Rename failed',
            })
            
            // Restore if failed
            setRecentRenameBlocklist(prev => {
              const next = new Map(prev);
              next.delete(f.id);
              return next;
            });
            setRefreshKey(k => k + 1); // Restore from server
          } finally {
            p.setRequestCorrelationId(undefined)
            setRenameModal({ open: false, file: null })
          }
        }} />}
        {showNewFolderModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] p-6 shadow-[var(--cf-shadow-strong)]">
              <div className="mb-5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Create Folder</div>
                <h3 className="mt-2 text-xl font-semibold text-[var(--cf-text-0)]">New folder</h3>
                <p className="mt-2 text-sm text-[var(--cf-text-1)]">
                  This will be created in <span className="font-medium text-[var(--cf-text-0)]">{resolvedCreationTarget?.targetLabel || writeTargetLabel}</span>.
                </p>
                <p className="mt-1 text-xs text-[var(--cf-text-2)]">{resolvedCreationTarget?.pathLabel || currentPath}</p>
              </div>
              <label className="block">
                <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Folder Name</span>
                <input
                  data-testid="cf-new-folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder"
                  className="w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] outline-none transition focus:border-[var(--cf-blue)]"
                />
              </label>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeNewFolderModal}
                  className="rounded-xl border border-[var(--cf-border)] px-4 py-2 text-sm font-medium text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="cf-create-folder-submit"
                  onClick={() => void handleCreateFolder()}
                  disabled={creatingFolder}
                  className="rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--cf-blue)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showNewFileModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-lg rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] p-6 shadow-[var(--cf-shadow-strong)]">
              <div className="mb-5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Create File</div>
                <h3 className="mt-2 text-xl font-semibold text-[var(--cf-text-0)]">Starter file</h3>
                <p className="mt-2 text-sm text-[var(--cf-text-1)]">
                  Create a common file type directly in <span className="font-medium text-[var(--cf-text-0)]">{resolvedCreationTarget?.targetLabel || writeTargetLabel}</span>.
                </p>
                <p className="mt-1 text-xs text-[var(--cf-text-2)]">{resolvedCreationTarget?.pathLabel || currentPath}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">File Name</span>
                  <input
                    data-testid="cf-new-file-name"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder={getStarterFileTemplate(newFileTemplateId).suggestedBaseName}
                    className="w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] outline-none transition focus:border-[var(--cf-blue)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Template</span>
                  <select
                    data-testid="cf-new-file-template"
                    value={newFileTemplateId}
                    onChange={(e) => setNewFileTemplateId(e.target.value as StarterFileTemplateId)}
                    className="w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] outline-none transition focus:border-[var(--cf-blue)]"
                  >
                    {STARTER_FILE_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label} ({template.extension})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Will Create</div>
                <div className="mt-2 break-all text-sm font-medium text-[var(--cf-text-0)]">
                  {buildStarterFileName(newFileName, newFileTemplateId)}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeNewFileModal}
                  className="rounded-xl border border-[var(--cf-border)] px-4 py-2 text-sm font-medium text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="cf-create-file-submit"
                  onClick={() => void handleCreateStarterFile()}
                  disabled={creatingFile}
                  className="rounded-xl border border-[rgba(0,201,167,0.28)] bg-[rgba(0,201,167,0.12)] px-4 py-2 text-sm font-semibold text-[var(--cf-teal)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingFile ? 'Creating...' : 'Create File'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showShortcutHelp && <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />}

        <div className="cf-toolbar-card mx-4 mt-4 flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-[var(--cf-border)] px-4 py-4 md:px-5 md:py-5">
          <div className="min-w-0 flex-1">
            <UnifiedBreadcrumb selectedProvider={selectedProvider} activeAccountName={activeAccountName} stack={breadcrumbStack} onNavigateStack={handleBreadcrumbNavigate} onNavigateHome={() => handleSidebarNavigate('all')} />
          </div>
          <div className="flex w-full max-w-[980px] flex-col items-stretch gap-3 lg:w-auto lg:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <span className="cf-micro-label">
                {writeActionsDisabled ? 'Read Only Scope' : 'Write Target'}
              </span>
              {!writeActionsDisabled && (
                <span className="truncate font-medium text-[var(--cf-text-1)]">
                  {resolvedCreationTarget?.targetLabel || writeTargetLabel}
                </span>
              )}
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-3">
            {selectedProvider === 'all' && !searchQuery && (
              <>
                <div className="cf-toolbar-card flex flex-wrap items-center gap-2 rounded-[20px] px-2 py-2">
                  <span className="cf-micro-label px-2">Views</span>
                  {/* View Toggles */}
                  <div className="flex overflow-hidden rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)]">
                    <button
                      data-testid="cf-allproviders-view-toggle-grouped"
                      onClick={() => !isGroupedView && !isAggregatedView && toggleGroupedView()}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${isGroupedView && !isAggregatedView ? 'bg-[rgba(74,158,255,0.12)] text-[var(--cf-text-0)]' : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'} disabled:cursor-not-allowed disabled:opacity-50`}
                      aria-pressed={isGroupedView && !isAggregatedView}
                      disabled={isAggregatedView}
                    >
                      Grouped
                    </button>
                    <button
                      data-testid="cf-allproviders-view-toggle-flat"
                      onClick={() => isGroupedView && !isAggregatedView && toggleGroupedView()}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${!isGroupedView && !isAggregatedView ? 'bg-[rgba(74,158,255,0.12)] text-[var(--cf-text-0)]' : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'} disabled:cursor-not-allowed disabled:opacity-50`}
                      aria-pressed={!isGroupedView && !isAggregatedView}
                      disabled={isAggregatedView}
                    >
                      Flat
                    </button>
                    <button
                      data-testid="cf-aggregated-view-toggle"
                      onClick={() => {
                        // When turning ON aggregated view, make sure we're in flat view
                        if (!isAggregatedView && isGroupedView) {
                          toggleGroupedView();
                        }
                        setIsAggregatedView(prev => !prev);
                      }}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${isAggregatedView ? 'bg-[rgba(0,201,167,0.1)] text-[var(--cf-text-0)]' : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'}`}
                      aria-pressed={isAggregatedView}
                    >
                      Aggregated
                    </button>
                  </div>

                  {/* Aggregated Mode Controls - Only show when aggregated is active */}
                  {isAggregatedView && (
                    <>
                      {/* Provider Filter Dropdown */}
                      <div className="flex overflow-hidden rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)]">
                        <select
                          value={aggregatedProviderFilter || 'all'}
                          onChange={(e) => setAggregatedProviderFilter(e.target.value as ProviderId | 'all' | null)}
                          className="border-none bg-transparent px-3 py-2 text-sm font-medium text-[var(--cf-text-1)] focus:outline-none"
                          aria-label="Filter providers"
                        >
                          <option value="all">All Providers</option>
                          {/* Deduplicate providers by ID to avoid multiple entries for multi-account connections */}
                          {Array.from(new Set(connectedProviders.map(cp => cp.providerId))).map(providerId => (
                            <option key={providerId} value={providerId}>
                              {PROVIDERS.find(p => p.id === providerId)?.name || providerId}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Duplicates Only Toggle */}
                      <div className="flex overflow-hidden rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)]">
                        <button
                          data-testid="cf-duplicates-filter-toggle"
                          onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${showDuplicatesOnly ? 'bg-[rgba(167,139,250,0.1)] text-[var(--cf-text-0)]' : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'}`}
                          aria-pressed={showDuplicatesOnly}
                        >
                          Duplicates Only
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <div className="cf-toolbar-card flex min-w-[280px] flex-1 items-center gap-2 rounded-[20px] px-2 py-2 lg:min-w-[320px] lg:flex-none">
              <span className="cf-micro-label px-2">Search</span>
              <div className="relative flex-1">
                <input data-testid="cf-global-search-input" type="text" placeholder="Search files across providers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-[14px] border border-transparent bg-transparent px-4 py-2.5 pl-10 text-sm text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[rgba(74,158,255,0.22)] focus:bg-[var(--cf-panel-softer)] focus:outline-none md:min-w-[18rem]" />
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" /></div>}
              </div>
            </div>
            <div className="cf-toolbar-card flex flex-wrap items-center gap-2 rounded-[20px] px-2 py-2">
              <span className="cf-micro-label px-2">Actions</span>
              <button
                data-testid="cf-action-new-folder"
                onClick={openNewFolderModal}
                disabled={writeActionsDisabled}
                className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)] transition-colors hover:border-[rgba(74,158,255,0.18)] hover:text-[var(--cf-text-0)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                New Folder
              </button>
              <button
                data-testid="cf-action-new-file"
                onClick={openNewFileModal}
                disabled={writeActionsDisabled}
                className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)] transition-colors hover:border-[rgba(255,159,67,0.18)] hover:text-[var(--cf-text-0)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                New File
              </button>
              <button
                data-testid="cf-action-upload"
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploading || connectedProviders.length === 0}
                className="rounded-xl border border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.08)] px-3 py-2 text-sm font-medium text-[var(--cf-teal)] transition-colors hover:bg-[rgba(0,201,167,0.13)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <button data-testid="files-refresh" onClick={() => void handleRefresh()} className="rounded-xl border border-[var(--cf-border)] p-2 text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
            </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6">
            {error && (
              <div data-testid="cf-error-banner" className="mb-6 flex items-center gap-3 rounded-[20px] border border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.1)] px-4 py-3 text-[var(--cf-red)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="min-w-0">
                  <div className="cf-micro-label text-[var(--cf-red)]">Load Status</div>
                  <p className="mt-1 text-sm font-medium text-[var(--cf-red)]">{error}</p>
                </div>
              </div>
            )}
            {selectedProvider === 'activity' ? <ActivityFeed />
            : selectedProvider === 'starred' ? <StarredView onFileClick={handleFileOpen} onRemoveFavorite={async (fileId, provider, accountKey) => { await handleToggleFavorite({ id: fileId, provider, accountKey } as any) }} />
            : loading && files.length === 0 ? (
              /* UI-P1-T06: Loading state card - Polished */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="cf-panel relative max-w-xl overflow-hidden rounded-[32px] p-6 sm:p-8">
                  <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(74,158,255,0.6),transparent)]" />
                  <div className="mb-6 flex items-center justify-between gap-6 border-b border-[var(--cf-border)] pb-6">
                    <div>
                      <div className="cf-kicker mb-2">Workspace</div>
                      <h3 className="text-xl font-semibold text-[var(--cf-text-0)] sm:text-2xl">Loading files...</h3>
                      <p className="mt-2 text-sm text-[var(--cf-text-1)]">Hydrating the current file scope from connected providers.</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.08)]">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--cf-blue)]/25 border-t-[var(--cf-blue)]" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-4">
                      <div className="cf-kicker mb-1">View</div>
                      <div className="text-sm font-semibold text-[var(--cf-text-0)]">{isAggregatedView ? 'Aggregated' : isGroupedView ? 'Grouped' : 'Flat'}</div>
                    </div>
                    <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-4">
                      <div className="cf-kicker mb-1">Path</div>
                      <div className="truncate font-mono text-xs text-[var(--cf-text-1)]">{currentPath}</div>
                    </div>
                    <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-4">
                      <div className="cf-kicker mb-1">Providers</div>
                      <div className="text-sm font-semibold text-[var(--cf-text-0)]">{connectedProviders.length || 0} connected</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : !loading && files.length === 0 ? (
              /* UI-P1-T06: Empty state card - Polished */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="cf-panel relative max-w-xl overflow-hidden rounded-[32px] p-6 sm:p-8 text-center">
                  <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,201,167,0.4),transparent)]" />
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] text-2xl">
                    📁
                  </div>
                  <div className="cf-kicker mb-2">Directory state</div>
                  <h3 className="text-xl font-semibold text-[var(--cf-text-0)] sm:text-2xl">This folder is empty</h3>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--cf-text-1)]">
                    No files or subdirectories found. Create content or upload a file into the current writable scope.
                  </p>
                  <div className="mt-8 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-5 py-5 text-left">
                      <div className="cf-kicker mb-2">Current Scope</div>
                      <div className="text-sm font-semibold text-[var(--cf-text-0)]">{writeTargetLabel}</div>
                      <div className="mt-1 truncate font-mono text-xs text-[var(--cf-text-2)]">{currentPath}</div>
                    </div>
                    <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-5 py-5 text-left">
                      <div className="cf-kicker mb-2">Context</div>
                      <div className="text-sm text-[var(--cf-text-1)]">
                        {writeActionsDisabled ? 'Switch to a writable provider scope.' : 'Ready for new content seeding.'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={openNewFolderModal}
                      disabled={writeActionsDisabled}
                      className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-5 py-2.5 text-sm font-semibold text-[var(--cf-text-1)] transition hover:border-[rgba(74,158,255,0.18)] hover:text-[var(--cf-text-0)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      New Folder
                    </button>
                    <button
                      type="button"
                      onClick={openNewFileModal}
                      disabled={writeActionsDisabled}
                      className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-5 py-2.5 text-sm font-semibold text-[var(--cf-text-1)] transition hover:border-[rgba(255,159,67,0.18)] hover:text-[var(--cf-text-0)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      New File
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={writeActionsDisabled}
                      className="rounded-2xl border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.12)] px-5 py-2.5 text-sm font-semibold text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Upload Content
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats row - Polished */}
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {quickStats.map((item) => (
                    <div key={item.label} className="cf-panel relative overflow-hidden rounded-[24px] p-5">
                      <div className="cf-kicker mb-3 uppercase tracking-[0.12em] text-[var(--cf-text-2)]">
                        {item.label}
                      </div>
                      <div className={`truncate text-2xl font-bold tracking-tight ${item.accent}`}>
                        {item.value}
                      </div>
                      <div className="mt-2 text-[12px] leading-relaxed text-[var(--cf-text-2)]">
                        {item.helper}
                      </div>
                    </div>
                  ))}
                </section>

                {/* When aggregated mode is on, force flat list regardless of grouped/flat toggle */}
                {isAggregatedView ? (
                  <div className="overflow-hidden rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-elev)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cf-border)] bg-[var(--cf-panel-softer)] px-5 py-4">
                      <div>
                        <div className="cf-micro-label">Aggregated Surface</div>
                        <div className="mt-1 text-sm text-[var(--cf-text-1)]">Merged view for duplicate detection and cross-provider comparison.</div>
                      </div>
                      <div className="cf-chip">
                        {sortedFiles.length} indexed items
                      </div>
                    </div>
                    <FileTable files={sortedFiles} selectedFiles={selectedFiles} focusedIndex={focusedIndex} favorites={favorites} isFavoriting={isFavoriting} pendingFolderPath={pendingFolderPath} onSelect={(id: string) => { const n = new Set(selectedFiles); if (n.has(id)) n.delete(id); else n.add(id); setSelectedFiles(n) }} onFolderClick={handleFolderClick} onOpen={handleFileOpen} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} onToggleFavorite={handleToggleFavorite} onCreateFolderInFolder={openCreateInsideFolder} onCreateFileInFolder={openCreateInsideFolder} showProviderBadge={true} showDuplicateBadge={isAggregatedView} />
                  </div>
                ) : groupedFiles ? groupedFiles.map(group => (
                  <section key={group.label} data-testid={`cf-allproviders-group-section-${group.accountKey}`} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[var(--cf-text-2)]"><span>{PROVIDERS.find(p => p.id === group.providerId)?.icon}</span> {group.label}</h3>
                      <span className="rounded-full border border-[rgba(74,158,255,0.2)] bg-[rgba(74,158,255,0.08)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-blue)]">
                        {group.files.length} items
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-elev)]">
                      <FileTable files={group.files} selectedFiles={selectedFiles} focusedIndex={focusedIndex} favorites={favorites} isFavoriting={isFavoriting} pendingFolderPath={pendingFolderPath} onSelect={(id: string) => { const n = new Set(selectedFiles); if (n.has(id)) n.delete(id); else n.add(id); setSelectedFiles(n) }} onFolderClick={handleFolderClick} onOpen={handleFileOpen} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} onToggleFavorite={handleToggleFavorite} onCreateFolderInFolder={openCreateInsideFolder} onCreateFileInFolder={openCreateInsideFolder} showProviderBadge={false} showDuplicateBadge={isAggregatedView} />
                    </div>
                  </section>
                )) : (
                  <div className="overflow-hidden rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-elev)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cf-border)] bg-[var(--cf-panel-softer)] px-5 py-4">
                      <div>
                        <div className="cf-micro-label">File Surface</div>
                        <div className="mt-1 text-sm text-[var(--cf-text-1)]">Live browser view for the current provider scope and folder depth.</div>
                      </div>
                      <div className="cf-chip cf-chip-teal">
                        {sortedFiles.length} visible rows
                      </div>
                    </div>
                    <FileTable files={sortedFiles} selectedFiles={selectedFiles} focusedIndex={focusedIndex} favorites={favorites} isFavoriting={isFavoriting} pendingFolderPath={pendingFolderPath} onSelect={(id: string) => { const n = new Set(selectedFiles); if (n.has(id)) n.delete(id); else n.add(id); setSelectedFiles(n) }} onFolderClick={handleFolderClick} onOpen={handleFileOpen} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} onToggleFavorite={handleToggleFavorite} onCreateFolderInFolder={openCreateInsideFolder} onCreateFileInFolder={openCreateInsideFolder} showProviderBadge={selectedProvider === 'all' || !!searchQuery} showDuplicateBadge={isAggregatedView} />
                  </div>
                )}
              </div>
            )}
          </div>
          {previewPanelFile && <PreviewPanel file={previewPanelFile.file} url={previewPanelFile.url} type={previewPanelFile.type} textContent={previewPanelFile.textContent} previewLoading={previewPanelFile.previewLoading} previewError={previewPanelFile.previewError} onClose={() => setPreviewPanelFile(null)} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} />}
        </div>
        <SelectionToolbar selectedFiles={selectedFileObjects} onOpen={handleFileOpen} onDownload={(fs) => fs.length === 1 ? handleFileDownload(fs[0]) : actions.notify({ kind: 'info', title: 'Bulk Download', message: 'Coming soon!' })} onRename={handleFileRename} onMove={(fs) => setTransferModal({ open: true, mode: 'move', file: fs[0], initialFolderPath: currentTransferFolderPath })} onCopy={(fs) => setTransferModal({ open: true, mode: 'copy', file: fs[0], initialFolderPath: currentTransferFolderPath })} onDelete={(fs) => fs.length === 1 ? handleFileDelete(fs[0]) : actions.notify({ kind: 'info', title: 'Bulk Delete', message: 'Coming soon!' })} onClearSelection={() => setSelectedFiles(new Set())} />
        <TransferQueuePanel />
      </main>
    </div>
  )
}

function FileTable({ files, selectedFiles, focusedIndex, favorites, isFavoriting, pendingFolderPath, onSelect, onFolderClick, onOpen, onDownload, onRename, onMove, onCopy, onDelete, onToggleFavorite, onCreateFolderInFolder, onCreateFileInFolder, showProviderBadge, showDuplicateBadge }: any) {
  return (
    <table className="w-full table-fixed text-left">
      <thead className="sticky top-0 z-10 border-b border-[var(--cf-border)] bg-[var(--cf-table-head-bg)] font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-2)]">
        <tr><th className="px-4 py-3 w-10"></th><th className="px-2 py-3 w-10"></th><th className="px-4 py-3">Name</th>{showProviderBadge && <th className="px-4 py-3 w-36">Provider</th>}<th className="px-4 py-3 w-24">Size</th><th className="px-4 py-3 w-32">Modified</th><th className="px-4 py-3 w-12"></th></tr>
      </thead>
      <tbody className="divide-y divide-[var(--cf-divider-soft)]">
        {files.map((file: any, idx: number) => (
          <FileRow key={file.id} file={file} selected={selectedFiles.has(file.id)} focused={focusedIndex === idx} isFavorite={favorites.has(file.id)} isFavoriting={isFavoriting.has(file.id)} isOpeningFolder={pendingFolderPath === getFolderNavigationTarget(file)} onSelect={() => onSelect(file.id)} onFolderClick={onFolderClick} onOpen={onOpen} onDownload={onDownload} onRename={onRename} onMove={onMove} onCopy={onCopy} onDelete={onDelete} onToggleFavorite={onToggleFavorite} onCreateFolderInFolder={onCreateFolderInFolder} onCreateFileInFolder={onCreateFileInFolder} showProviderBadge={showProviderBadge} showDuplicateBadge={showDuplicateBadge} />
        ))}
      </tbody>
    </table>
  )
}

function FileRow({ file, selected, focused, isFavorite, isFavoriting, isOpeningFolder, onSelect, onFolderClick, onOpen, onDownload, onRename, onMove, onCopy, onDelete, onToggleFavorite, onCreateFolderInFolder, onCreateFileInFolder, showProviderBadge, showDuplicateBadge }: any) {
  const provider = PROVIDERS.find(p => p.id === file.provider); const [showOverflow, setShowOverflow] = useState(false)
  const isDuplicate = file.isDuplicate || (file.providers && file.providers.length > 1)
  const providerCount = file.providers?.length || 1
  const resolvedFileName = file.name || '[unnamed]'
  const handleOverflowAction = (e: any, action: () => void) => {
    e.stopPropagation()
    action()
    setShowOverflow(false)
  }
  return (
    <tr draggable={!file.isFolder && !isOpeningFolder} data-testid="cf-file-row" data-file-id={file.id} data-file-name={resolvedFileName} data-provider-id={file.provider || ''} data-account-key={(file as any).accountKey || ''} onDragStart={(e) => { e.dataTransfer.setData('application/cacheflow-file', JSON.stringify(file)); e.dataTransfer.effectAllowed = 'copyMove' }} className={`group transition-all duration-200 ${selected ? 'bg-[rgba(74,158,255,0.12)]' : 'hover:bg-[var(--cf-hover-bg)]'} ${focused ? 'ring-2 ring-[var(--cf-blue)]/50 ring-inset z-10' : ''} ${isOpeningFolder ? 'cursor-progress bg-[rgba(74,158,255,0.14)]' : 'cursor-pointer'}`} onClick={() => isOpeningFolder ? undefined : file.isFolder ? onFolderClick(file) : onOpen(file)}>
      <td className="px-4 py-3.5">
        <input
          type="checkbox"
          data-testid="cf-row-checkbox"
          data-file-id={file.id}
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onSelect() }}
          className="rounded border-[var(--cf-border-2)] bg-transparent text-[var(--cf-blue)] opacity-0 transition-opacity group-hover:opacity-100 checked:opacity-100"
        />
      </td>
      <td className="px-2 py-3.5">
        <button
          data-testid="cf-row-star-toggle"
          data-loading={isFavoriting}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(file) }}
          className={`transition-colors ${isFavorite ? 'text-[var(--cf-amber)]' : 'text-[var(--cf-text-3)] hover:text-[var(--cf-text-1)]'} ${isFavoriting ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
          disabled={isFavoriting}
        >
          ⭐
        </button>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--cf-border)] ${file.isFolder ? 'bg-[rgba(74,158,255,0.12)] text-[var(--cf-blue)]' : 'bg-[rgba(255,255,255,0.03)] text-[var(--cf-text-2)]'} ${isOpeningFolder ? 'animate-pulse' : ''}`}>{file.isFolder ? '📁' : getFileIcon(file.mimeType)}</span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className={`truncate text-sm font-medium ${resolvedFileName === '[unnamed]' ? 'text-[var(--cf-amber)]' : 'text-[var(--cf-text-0)]'}`}>{resolvedFileName}</p>
              {isOpeningFolder && (
                <span className="whitespace-nowrap rounded-full border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--cf-blue)]">
                  Opening...
                </span>
              )}
              {showDuplicateBadge && isDuplicate && (
                <span className="whitespace-nowrap rounded-full border border-[rgba(167,139,250,0.28)] bg-[rgba(167,139,250,0.12)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--cf-purple)]" title={`Also on ${providerCount - 1} other provider${providerCount > 2 ? 's' : ''}`}>
                  📋 {providerCount}x
                </span>
              )}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--cf-text-2)]">
              <span className="text-[11px] font-medium normal-case tracking-normal">{file.isFolder ? 'Folder' : file.mimeType?.split('/')[1] || 'File'}</span>
              {showProviderBadge && provider && (
                <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium normal-case tracking-normal">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: provider.color }} />
                  <span className="truncate">{providerLabel(file)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      {showProviderBadge && <td className="px-4 py-3.5"><div className="flex items-center gap-2 overflow-hidden"><span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: provider?.color || 'var(--cf-text-3)' }} /><span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-2)]">{providerLabel(file)}</span></div></td>}
      <td className="px-4 py-3.5 font-mono text-[11px] font-medium text-[var(--cf-text-1)]">{file.isFolder ? '—' : formatBytes(file.size)}</td>
      <td className="px-4 py-3.5 font-mono text-[11px] font-medium tabular-nums text-[var(--cf-text-1)]">{file.modifiedTime?.split('T')[0]}</td>
      <td className="relative px-4 py-3.5"><button data-testid="cf-files-row-overflow" onClick={(e) => { e.stopPropagation(); setShowOverflow(!showOverflow) }} className="rounded-xl border border-transparent bg-transparent p-1.5 font-bold text-[var(--cf-text-2)] opacity-0 transition-all group-hover:border-[var(--cf-border)] group-hover:bg-[var(--cf-panel-soft)] group-hover:opacity-100 hover:bg-[var(--cf-hover-bg)]">•••</button>
        {showOverflow && <> <div className="absolute inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowOverflow(false) }} /> <div className="absolute right-4 top-full z-30 w-52 rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-menu-bg)] py-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100"> <button onClick={(e) => handleOverflowAction(e, () => onOpen(file))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>👁️</span> Open</button> <button onClick={(e) => handleOverflowAction(e, () => onDownload(file))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>⬇️</span> Download</button> {file.isFolder && <><div className="my-1 border-t border-[var(--cf-border)]" /> <button data-testid="cf-files-row-new-folder-here" onClick={(e) => handleOverflowAction(e, () => onCreateFolderInFolder(file, 'folder'))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>📁</span> New Folder Here</button> <button data-testid="cf-files-row-new-file-here" onClick={(e) => handleOverflowAction(e, () => onCreateFileInFolder(file, 'file'))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>📝</span> New File Here</button></>} <div className="my-1 border-t border-[var(--cf-border)]" /> <button onClick={(e) => handleOverflowAction(e, () => onRename(file))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>✏️</span> Rename</button> <button onClick={(e) => handleOverflowAction(e, () => onMove(file))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>📦</span> Move</button> <button onClick={(e) => handleOverflowAction(e, () => onCopy(file))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)]"><span>📄</span> Copy</button> <div className="my-1 border-t border-[var(--cf-border)]" /> <button onClick={(e) => handleOverflowAction(e, () => onDelete(file))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-[var(--cf-red)] hover:bg-[rgba(255,92,92,0.08)]"><span>🗑️</span> Delete</button> </div> </>}
      </td>
    </tr>
  )
}

function dateMsSafe(d?: string | null) { const ms = Date.parse(d || ''); return isNaN(ms) ? 0 : ms }
function providerLabel(f: FileMetadata) { return (f as any).sourceLabel || f.providerName || f.provider }

function normalizeFileMetadata(
  file: any,
  options: { fallbackName?: string } = {},
): FileMetadata {
  const resolvedName =
    file?.name ||
    file?.title ||
    file?.filename ||
    options.fallbackName ||
    'untitled'
  const resolvedPath = file?.path || file?.pathDisplay || `/${resolvedName}`
  const resolvedMimeType = file?.mimeType || file?.mime_type || 'application/octet-stream'

  return {
    ...file,
    id: String(file?.id || file?.fileId || `${resolvedPath}:${resolvedName}`),
    name: String(resolvedName),
    path: String(resolvedPath),
    pathDisplay: String(file?.pathDisplay || resolvedPath),
    size: Number(file?.size || 0),
    mimeType: String(resolvedMimeType),
    isFolder: Boolean(file?.isFolder),
    modifiedTime: file?.modifiedTime || file?.modified_at || new Date().toISOString(),
    providerName: file?.providerName || file?.provider || 'provider',
  } as FileMetadata
}

function renameFilePath(pathValue: string | undefined, nextName: string): string | undefined {
  if (!pathValue) return pathValue
  const normalized = String(pathValue)
  if (!normalized) return normalized
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) return nextName
  return `${normalized.slice(0, lastSlash + 1)}${nextName}`
}

function applyRenamedMetadata(file: FileMetadata, nextName: string): FileMetadata {
  return normalizeFileMetadata({
    ...file,
    name: nextName,
    path: renameFilePath(file.path, nextName) || file.path,
    pathDisplay: renameFilePath(file.pathDisplay || file.path, nextName) || file.pathDisplay || file.path,
    modifiedTime: new Date().toISOString(),
  })
}

function getFolderNavigationTarget(file: FileMetadata): string {
  if (!file.isFolder) return String(file.path || file.id)

  switch (file.provider) {
    case 'box':
    case 'google':
    case 'onedrive':
    case 'pcloud':
      return String(file.id || file.path)
    default:
      return String(file.path || file.id)
  }
}

export function buildNextBreadcrumbStack(
  currentStack: Array<{ id: string; name: string }>,
  file: FileMetadata,
  nextPath: string,
): Array<{ id: string; name: string }> {
  if (nextPath.startsWith('/')) {
    const segments = nextPath.split('/').filter(Boolean)
    let runningPath = ''
    return segments.map((segment) => {
      runningPath = `${runningPath}/${segment}`
      return { id: runningPath, name: segment }
    })
  }

  const existingIndex = currentStack.findIndex((entry) => entry.id === nextPath)
  if (existingIndex >= 0) {
    return currentStack.slice(0, existingIndex + 1)
  }

  return [...currentStack, { id: nextPath, name: file.name }]
}

export function getFileIcon(mimeType: string): string {
  if (mimeType?.startsWith('image/')) return '🖼️'
  if (mimeType?.startsWith('video/')) return '🎬'
  if (mimeType?.includes('pdf')) return '📄'
  if (mimeType?.includes('zip')) return '📦'
  if (mimeType?.includes('word')) return '📝'
  if (mimeType?.includes('excel')) return '📊'
  return '📄'
}
function rootFolderId(p: ProviderId) {
  switch (p) {
    case 'google': case 'onedrive': return 'root'
    case 'box': case 'pcloud': return '0'
    case 'dropbox': case 'filen': return ''
    case 'webdav': case 'vps': case 'yandex': return '/'
    default: return 'root'
  }
}

type StarterFileTemplateId = 'txt' | 'md' | 'json' | 'csv' | 'html' | 'js' | 'ts' | 'tsx' | 'css' | 'xml'

type CreationTargetOverride = {
  providerId: ProviderId
  accountKey: string
  folderId: string
  pathLabel: string
  targetLabel: string
}

type StarterFileTemplate = {
  id: StarterFileTemplateId
  label: string
  extension: string
  mimeType: string
  suggestedBaseName: string
  content: string
}

const STARTER_FILE_TEMPLATES: StarterFileTemplate[] = [
  { id: 'txt', label: 'Text', extension: '.txt', mimeType: 'text/plain', suggestedBaseName: 'notes', content: '' },
  { id: 'md', label: 'Markdown', extension: '.md', mimeType: 'text/markdown', suggestedBaseName: 'README', content: '# New Document\n' },
  { id: 'json', label: 'JSON', extension: '.json', mimeType: 'application/json', suggestedBaseName: 'data', content: '{\n  \n}\n' },
  { id: 'csv', label: 'CSV', extension: '.csv', mimeType: 'text/csv', suggestedBaseName: 'data', content: 'column1,column2\n' },
  { id: 'html', label: 'HTML', extension: '.html', mimeType: 'text/html', suggestedBaseName: 'index', content: '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <title>New Document</title>\n  </head>\n  <body>\n  </body>\n</html>\n' },
  { id: 'js', label: 'JavaScript', extension: '.js', mimeType: 'text/javascript', suggestedBaseName: 'script', content: 'export {}\n' },
  { id: 'ts', label: 'TypeScript', extension: '.ts', mimeType: 'text/typescript', suggestedBaseName: 'index', content: 'export {}\n' },
  { id: 'tsx', label: 'TSX', extension: '.tsx', mimeType: 'text/tsx', suggestedBaseName: 'Component', content: 'export function Component() {\n  return <div />\n}\n' },
  { id: 'css', label: 'CSS', extension: '.css', mimeType: 'text/css', suggestedBaseName: 'styles', content: ':root {\n  color-scheme: light dark;\n}\n' },
  { id: 'xml', label: 'XML', extension: '.xml', mimeType: 'application/xml', suggestedBaseName: 'document', content: '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<root />\n' },
]

function getStarterFileTemplate(templateId: StarterFileTemplateId): StarterFileTemplate {
  return STARTER_FILE_TEMPLATES.find((template) => template.id === templateId) || STARTER_FILE_TEMPLATES[0]
}

export function buildStarterFileName(rawName: string, templateId: StarterFileTemplateId): string {
  const template = getStarterFileTemplate(templateId)
  const baseName = rawName.trim() || template.suggestedBaseName
  return baseName.toLowerCase().endsWith(template.extension) ? baseName : `${baseName}${template.extension}`
}

export function buildStarterFileContent(templateId: StarterFileTemplateId): string {
  return getStarterFileTemplate(templateId).content
}
