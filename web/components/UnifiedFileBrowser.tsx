'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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

interface UnifiedFileBrowserProps {
  token: string
}

export default function UnifiedFileBrowser({ token }: UnifiedFileBrowserProps) {
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
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [previewPanelFile, setPreviewPanelFile] = useState<{ file: FileMetadata, url: string | null, type: 'image' | 'pdf' | 'text' | 'other' } | null>(null)
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'move', file: FileMetadata } | null>(null)
  const [draggedFile, setDraggedFile] = useState<FileMetadata | null>(null)

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
  
  const actions = useActionCenter()
  const { addTransfer } = useTransferQueue()
  const [transferModal, setTransferModal] = useState<{ open: boolean; mode: 'copy' | 'move'; file: FileMetadata | null; correlationId?: string }>({ open: false, mode: 'copy', file: null })
  const [renameModal, setRenameModal] = useState<{ open: boolean; file: FileMetadata | null; correlationId?: string }>({ open: false, file: null })

  // Selection computed
  const selectedFileObjects = useMemo(() => {
    return files.filter(f => selectedFiles.has(f.id))
  }, [files, selectedFiles])

  // Load favorites
  useEffect(() => {
    if (token) {
      fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(body => { if (body.ok) setFavorites(new Set(body.data.favorites.map((f: any) => f.file_id))) })
        .catch(err => { console.error('Failed to fetch favorites:', err); setError('Failed to load favorites'); })
    }
  }, [token])

  // Load UI preferences
  useEffect(() => {
    if (localStorage.getItem('cacheflow:ui:sidebarCollapsed') === 'true') setIsSidebarCollapsed(true)
    if (localStorage.getItem('cacheflow:ui:allProvidersView') === 'flat') setIsGroupedView(false)
  }, [])

  const toggleGroupedView = () => {
    const newState = !isGroupedView
    setIsGroupedView(newState); localStorage.setItem('cacheflow:ui:allProvidersView', newState ? 'grouped' : 'flat')
  }

  // Load connected providers - SYNC-1: fetch from server state API
  useEffect(() => {
    let tokensChanged = false
    const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'vps', 'webdav', 'local']

    if (token && !tokenManager.hasToken('local')) {
      tokenManager.saveToken('local', {
        provider: 'local',
        accessToken: token,
        accountEmail: 'local-storage',
        displayName: 'Local Storage',
        expiresAt: null,
      })
      tokensChanged = true
    }

    const loadConnections = async () => {
      let serverConnections: ProviderConnection[] = []
      try {
        const result = await apiClient.getConnections()
        if (result.success && result.data) {
          serverConnections = result.data
        }
      } catch (err) {
        console.warn('[UnifiedFileBrowser] Failed to fetch server connections, using localStorage only:', err)
        setError('Failed to sync provider connections')
      }

      // Hydrate token manager from server-state remotes so seeded QA accounts appear after login.
      for (const conn of serverConnections) {
        const pid = conn.provider as ProviderId
        if (!providerIds.includes(pid)) continue

        const accountKey = conn.accountKey || conn.accountEmail || conn.accountName || conn.id
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
                displayName: conn.accountLabel || conn.accountName || existing?.displayName || accountKey,
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

      if (tokensChanged) {
        setRefreshKey(k => k + 1)
        return
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
              displayName: t.displayName || serverConn?.accountLabel || serverConn?.accountName || `${pid}-${idx + 1}`,
              accountKey: t.accountKey,
              connectedAt: serverConn?.lastSyncAt ? new Date(serverConn.lastSyncAt).getTime() : Date.now()
            })
            if (!loadingIds.includes(pid)) loadingIds.push(pid)
          }
        })
      }

      setConnectedProviders(connected)
      setLoadingProviders(loadingIds)
    }

    loadConnections()
  }, [token, refreshKey])
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

  // Fetch logic
  useEffect(() => {
    let isStale = false
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
          allResults.push(...result.files.map(f => ({ ...f, provider: account.providerId, providerName: PROVIDERS.find(p => p.id === account.providerId)?.name || account.providerId, accountKey: account.accountKey, sourceLabel: account.displayName, remoteId: (tokenData as any).remoteId } as any)))
        } catch (err: any) { warnings.push(`${account.displayName}: ${err.message}`) }
      }))
      if (isStale) return
      if (warnings.length > 0) setError(`Search partial failure: ${warnings.join(', ')}`)
      setFiles(allResults); setIsSearching(false); setLoading(false)
    }

    async function loadAllFiles() {
      if (searchQuery.trim()) { performSearch(); return }
      setFiles([]); setLoading(true); setError(null)
      if (['recent', 'starred', 'activity'].includes(selectedProvider)) { setLoading(false); return }

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
                return result.files.map(f => ({
                  ...f,
                  provider: account.providerId,
                  providerName: PROVIDERS.find(p => p.id === account.providerId)?.name || account.providerId,
                  accountKey: account.accountKey,
                  sourceLabel: account.displayName,
                  remoteId: (tokenData as any)?.remoteId
                } as FileMetadata))
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
          const converted = filtered.map(f => ({
            ...f,
            isDuplicate: f.isDuplicate,
            providers: f.providers
          } as FileMetadata & { isDuplicate?: boolean; providers?: ProviderId[] }))
          setFiles(converted)
          setSelectedFiles(new Set())
        } catch (err: any) {
          if (!isStale) {
            setError(`Aggregation failed: ${err.message}`)
          }
        } finally {
          if (!isStale) setLoading(false)
        }
        return
      }

      // Standard single-provider or non-aggregated mode
      const allFiles: FileMetadata[] = []
      const errors: string[] = []
      const pids = selectedProvider === 'all' ? loadingProviders : [selectedProvider as ProviderId]

      for (const pid of pids) {
        if (isStale) return
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
          if (isStale) return
          allFiles.push(...resultFiles.map(file => ({ ...file, provider: pid, providerName: PROVIDERS.find(p => p.id === pid)?.name || pid, accountKey: key, sourceLabel: (t as any).displayName || (t as any).accountEmail || pid, remoteId: (t as any).remoteId } as any)))
        }
      }
      if (isStale) return
      if (errors.length > 0) setError(`Failed to load: ${errors.join(', ')}`)
      setFiles(allFiles); setSelectedFiles(new Set()); setLoading(false)
    }
    const timer = setTimeout(() => { if (searchQuery.trim()) performSearch(); else loadAllFiles() }, searchQuery.trim() ? 500 : 0)
    return () => { isStale = true; clearTimeout(timer) }
  }, [selectedProvider, activeAccountKey, currentPath, refreshKey, loadingProviders, searchQuery, connectedProviders, isAggregatedView, showDuplicatesOnly, aggregatedProviderFilter])

  // Handlers
  const handleSidebarNavigate = (pid: any, key?: string) => { setSelectedProvider(pid); if (key) { setActiveAccountKey(key); tokenManager.setActiveToken(pid, key) } else setActiveAccountKey(''); setCurrentPath('/'); setBreadcrumbStack([]); setRefreshKey(k => k + 1) }
  const handleBreadcrumbNavigate = (idx: number) => { if (idx === -1) { setCurrentPath('/'); setBreadcrumbStack([]) } else { const target = breadcrumbStack[idx]; setCurrentPath(target.id); setBreadcrumbStack(prev => prev.slice(0, idx + 1)) } }
  const handleFolderClick = (file: FileMetadata) => { if (selectedProvider === 'all') { setSelectedProvider(file.provider as any); if ((file as any).accountKey) { setActiveAccountKey((file as any).accountKey); tokenManager.setActiveToken(file.provider as any, (file as any).accountKey) } }; setCurrentPath(file.path); setBreadcrumbStack(prev => [...prev, { id: file.path, name: file.name }]) }
  
  const handleToggleFavorite = async (file: FileMetadata) => {
    if (isFavoriting.has(file.id)) return
    setIsFavoriting(prev => new Set(prev).add(file.id))
    
    const isFav = favorites.has(file.id); const method = isFav ? 'DELETE' : 'POST'
    const url = isFav ? `/api/favorites/${file.id}?provider=${file.provider}&accountKey=${(file as any).accountKey}` : '/api/favorites'
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: isFav ? undefined : JSON.stringify({ provider: file.provider, accountKey: (file as any).accountKey, fileId: file.id, fileName: file.name, mimeType: file.mimeType, isFolder: file.isFolder, path: file.path }) })
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
    const task = actions.startTask({ title: 'Downloading', message: file.name, progress: null })
    try {
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider); if (!provider) throw new Error('Provider not available')
      provider.remoteId = (file as any).remoteId
      const blob = await provider.downloadFile(file.id); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); window.URL.revokeObjectURL(url); task.succeed(file.name)
    } catch (err: any) { task.fail(err.message) }
  }

  const handleFileOpen = async (file: FileMetadata) => {
    if (file.isFolder) { handleFolderClick(file); return }
    const task = actions.startTask({ title: 'Opening', message: file.name, progress: null })
    try {
      if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
      const provider = getProvider(file.provider); if (!provider) throw new Error('Provider not available')
      provider.remoteId = (file as any).remoteId
      const blob = await provider.downloadFile(file.id); const url = window.URL.createObjectURL(blob)
      let type: 'image' | 'pdf' | 'text' | 'other' = 'text'
      if (file.mimeType.startsWith('image/')) type = 'image'
      else if (file.mimeType === 'application/pdf') type = 'pdf'
      else if (file.mimeType.startsWith('text/')) type = 'text'
      setPreviewPanelFile({ file, url, type }); task.succeed(file.name)
    } catch (err: any) { task.fail(err.message) }
  }

  const handleFileMove = (file: FileMetadata) => setTransferModal({ open: true, mode: 'move', file })
  const handleFileCopy = (file: FileMetadata) => setTransferModal({ open: true, mode: 'copy', file })
  const handleFileRename = (file: FileMetadata) => setRenameModal({ open: true, file })
  const handleFileDelete = async (file: FileMetadata) => {
    if (await actions.confirm({ title: 'Delete?', message: `Delete "${file.name}"?`, confirmText: 'Delete', cancelText: 'Cancel' })) {
      const task = actions.startTask({ title: 'Deleting', message: file.name, progress: null })
      try {
        if ((file as any).accountKey) tokenManager.setActiveToken(file.provider as any, (file as any).accountKey)
        const provider = getProvider(file.provider); 
        if (!provider) throw new Error('Provider not found')
        provider.remoteId = (file as any).remoteId
        await provider.deleteFile(file.id); await metadataCache.invalidateCache(file.provider as any, (file as any).accountKey); setRefreshKey(k => k + 1); task.succeed(file.name)
      } catch (err: any) { task.fail(err.message) }
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

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden -mx-4 md:-mx-6">
      <Sidebar connectedProviders={connectedProviders} selectedProvider={selectedProvider} activeAccountKey={activeAccountKey} onNavigate={handleSidebarNavigate} onDrop={(e, pid, key, fid) => {
        e.preventDefault(); const d = e.dataTransfer.getData('application/cacheflow-file'); if (!d) return
        const f = JSON.parse(d); const mode = (f.provider === pid && f.accountKey === key) ? 'move' : 'copy'
        addTransfer({ type: mode, file: f, targetProviderId: pid, targetAccountKey: key, targetFolderId: fid })
      }} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {transferModal.open && transferModal.file && <TransferModal isOpen={transferModal.open} mode={transferModal.mode} file={transferModal.file} connectedProviderIds={Array.from(new Set(connectedProviders.map(cp => cp.providerId)))} onClose={() => setTransferModal({ open: false, mode: 'copy', file: null })} onSubmit={async (args) => { addTransfer({ type: transferModal.mode, file: transferModal.file!, ...args }); setTransferModal({ open: false, mode: 'copy', file: null }); setSelectedFiles(new Set()) }} />}
        {renameModal.open && renameModal.file && <RenameModal isOpen={renameModal.open} title="Rename" initialValue={renameModal.file?.name || ''} onClose={() => setRenameModal({ open: false, file: null })} onSubmit={async (newName) => { const f = renameModal.file!; const p = getProvider(f.provider)!; p.remoteId = (f as any).remoteId; await p.renameFile(f.id, newName); await metadataCache.invalidateCache(f.provider as any, (f as any).accountKey); setRenameModal({ open: false, file: null }); setRefreshKey(k => k + 1) }} />}
        {showShortcutHelp && <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />}

        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-wrap items-center justify-between gap-4">
          <UnifiedBreadcrumb selectedProvider={selectedProvider} activeAccountName={activeAccountName} stack={breadcrumbStack} onNavigateStack={handleBreadcrumbNavigate} onNavigateHome={() => handleSidebarNavigate('all')} />
          <div className="flex items-center gap-3">
            {selectedProvider === 'all' && !searchQuery && (
              <>
                <div className="flex flex-wrap gap-2">
                  {/* View Toggles */}
                  <div className="flex border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                    <button
                      data-testid="cf-allproviders-view-toggle-grouped"
                      onClick={() => !isGroupedView && !isAggregatedView && toggleGroupedView()}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${isGroupedView && !isAggregatedView ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      aria-pressed={isGroupedView && !isAggregatedView}
                      disabled={isAggregatedView}
                    >
                      Grouped
                    </button>
                    <button
                      data-testid="cf-allproviders-view-toggle-flat"
                      onClick={() => isGroupedView && !isAggregatedView && toggleGroupedView()}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${!isGroupedView && !isAggregatedView ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      aria-pressed={!isGroupedView && !isAggregatedView}
                      disabled={isAggregatedView}
                    >
                      Flat
                    </button>
                    <button
                      data-testid="cf-aggregated-view-toggle"
                      onClick={() => {
                        setIsAggregatedView(!isAggregatedView);
                        if (!isAggregatedView) {
                          // When turning on aggregated view, make sure we're in flat view
                          if (isGroupedView) toggleGroupedView();
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${isAggregatedView ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      aria-pressed={isAggregatedView}
                    >
                      Aggregated
                    </button>
                  </div>

                  {/* Aggregated Mode Controls - Only show when aggregated is active */}
                  {isAggregatedView && (
                    <>
                      {/* Provider Filter Dropdown */}
                      <div className="flex border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        <select
                          value={aggregatedProviderFilter || 'all'}
                          onChange={(e) => setAggregatedProviderFilter(e.target.value as ProviderId | 'all' | null)}
                          className="px-3 py-1.5 text-xs font-bold bg-transparent border-none focus:outline-none"
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
                      <div className="flex border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        <button
                          data-testid="cf-duplicates-filter-toggle"
                          onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                          className={`px-3 py-1.5 text-xs font-bold transition-colors ${showDuplicatesOnly ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
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
            <div className="relative">
              <input data-testid="cf-global-search-input" type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-48 md:w-64 px-4 py-1.5 pl-9 border border-gray-300 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500" />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" /></div>}
            </div>
            <button data-testid="files-refresh" onClick={() => setRefreshKey(k => k + 1)} className="p-2 hover:bg-gray-100 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
            {error && (
              <div data-testid="cf-error-banner" className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            {selectedProvider === 'activity' ? <ActivityFeed />
            : selectedProvider === 'starred' ? <StarredView onFileClick={handleFileOpen} onRemoveFavorite={async (fileId, provider, accountKey) => { await handleToggleFavorite({ id: fileId, provider, accountKey } as any) }} />
            : loading && files.length === 0 ? (
              /* UI-P1-T06: Loading state card */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 max-w-sm text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading files...</h3>
                  <p className="text-sm text-gray-500">Fetching your files from connected providers</p>
                </div>
              </div>
            ) : !loading && files.length === 0 ? (
              /* UI-P1-T06: Empty state card */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 max-w-sm text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No files yet</h3>
                  <p className="text-sm text-gray-500 mb-4">This folder is empty. Upload files or create a new folder to get started.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {/* When aggregated mode is on, force flat list regardless of grouped/flat toggle */}
                {isAggregatedView ? (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    <FileTable files={sortedFiles} selectedFiles={selectedFiles} focusedIndex={focusedIndex} favorites={favorites} isFavoriting={isFavoriting} onSelect={(id: string) => { const n = new Set(selectedFiles); if (n.has(id)) n.delete(id); else n.add(id); setSelectedFiles(n) }} onFolderClick={handleFolderClick} onOpen={handleFileOpen} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} onToggleFavorite={handleToggleFavorite} showProviderBadge={true} showDuplicateBadge={isAggregatedView} />
                  </div>
                ) : groupedFiles ? groupedFiles.map(group => (
                  <section key={group.label} data-testid={`cf-allproviders-group-section-${group.accountKey}`} className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><span>{PROVIDERS.find(p => p.id === group.providerId)?.icon}</span> {group.label} • {group.files.length} ITEMS</h3>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                      <FileTable files={group.files} selectedFiles={selectedFiles} focusedIndex={focusedIndex} favorites={favorites} isFavoriting={isFavoriting} onSelect={(id: string) => { const n = new Set(selectedFiles); if (n.has(id)) n.delete(id); else n.add(id); setSelectedFiles(n) }} onFolderClick={handleFolderClick} onOpen={handleFileOpen} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} onToggleFavorite={handleToggleFavorite} showProviderBadge={false} showDuplicateBadge={isAggregatedView} />
                    </div>
                  </section>
                )) : (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    <FileTable files={sortedFiles} selectedFiles={selectedFiles} focusedIndex={focusedIndex} favorites={favorites} isFavoriting={isFavoriting} onSelect={(id: string) => { const n = new Set(selectedFiles); if (n.has(id)) n.delete(id); else n.add(id); setSelectedFiles(n) }} onFolderClick={handleFolderClick} onOpen={handleFileOpen} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} onToggleFavorite={handleToggleFavorite} showProviderBadge={selectedProvider === 'all' || !!searchQuery} showDuplicateBadge={isAggregatedView} />
                  </div>
                )}
              </div>
            )}
          </div>
          {previewPanelFile && <PreviewPanel file={previewPanelFile.file} url={previewPanelFile.url} type={previewPanelFile.type} onClose={() => setPreviewPanelFile(null)} onDownload={handleFileDownload} onRename={handleFileRename} onMove={handleFileMove} onCopy={handleFileCopy} onDelete={handleFileDelete} />}
        </div>
        <SelectionToolbar selectedFiles={selectedFileObjects} onOpen={handleFileOpen} onDownload={(fs) => fs.length === 1 ? handleFileDownload(fs[0]) : actions.notify({ kind: 'info', title: 'Bulk Download', message: 'Coming soon!' })} onRename={handleFileRename} onMove={(fs) => setTransferModal({ open: true, mode: 'move', file: fs[0] })} onCopy={(fs) => setTransferModal({ open: true, mode: 'copy', file: fs[0] })} onDelete={(fs) => fs.length === 1 ? handleFileDelete(fs[0]) : actions.notify({ kind: 'info', title: 'Bulk Delete', message: 'Coming soon!' })} onClearSelection={() => setSelectedFiles(new Set())} />
        <TransferQueuePanel />
      </main>
    </div>
  )
}

function FileTable({ files, selectedFiles, focusedIndex, favorites, isFavoriting, onSelect, onFolderClick, onOpen, onDownload, onRename, onMove, onCopy, onDelete, onToggleFavorite, showProviderBadge, showDuplicateBadge }: any) {
  return (
    <table className="w-full text-left table-fixed">
      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-400 uppercase text-[9px] font-black tracking-widest border-b border-gray-100 dark:border-gray-800">
        <tr><th className="px-4 py-3 w-10"></th><th className="px-4 py-3 w-8"></th><th className="px-4 py-3">Name</th>{showProviderBadge && <th className="px-4 py-3 w-32">Provider</th>}<th className="px-4 py-3 w-24">Size</th><th className="px-4 py-3 w-32">Modified</th><th className="px-4 py-3 w-12"></th></tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {files.map((file: any, idx: number) => (
          <FileRow key={file.id} file={file} selected={selectedFiles.has(file.id)} focused={focusedIndex === idx} isFavorite={favorites.has(file.id)} isFavoriting={isFavoriting.has(file.id)} onSelect={() => onSelect(file.id)} onFolderClick={onFolderClick} onOpen={onOpen} onDownload={onDownload} onRename={onRename} onMove={onMove} onCopy={onCopy} onDelete={onDelete} onToggleFavorite={onToggleFavorite} showProviderBadge={showProviderBadge} showDuplicateBadge={showDuplicateBadge} />
        ))}
      </tbody>
    </table>
  )
}

function FileRow({ file, selected, focused, isFavorite, isFavoriting, onSelect, onFolderClick, onOpen, onDownload, onRename, onMove, onCopy, onDelete, onToggleFavorite, showProviderBadge, showDuplicateBadge }: any) {
  const provider = PROVIDERS.find(p => p.id === file.provider); const [showOverflow, setShowOverflow] = useState(false)
  const isDuplicate = file.isDuplicate || (file.providers && file.providers.length > 1)
  const providerCount = file.providers?.length || 1
  return (
    <tr draggable={!file.isFolder} onDragStart={(e) => { e.dataTransfer.setData('application/cacheflow-file', JSON.stringify(file)); e.dataTransfer.effectAllowed = 'copyMove' }} className={`group transition-all duration-200 ${selected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'} ${focused ? 'ring-2 ring-blue-500/50 ring-inset z-10' : ''}`} onClick={() => file.isFolder ? onFolderClick(file) : onOpen(file)}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onSelect() }}
          className="rounded border-gray-300 text-blue-600 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
        />
      </td>
      <td className="px-2 py-3">
        <button
          data-testid="cf-row-star-toggle"
          data-loading={isFavoriting}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(file) }}
          className={`transition-colors ${isFavorite ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700 hover:text-gray-400'} ${isFavoriting ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
          disabled={isFavoriting}
        >
          ⭐
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{file.isFolder ? '📁' : getFileIcon(file.mimeType)}</span>
          <div className="min-w-0 flex items-center gap-2">
            <p className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{file.name}</p>
            {showDuplicateBadge && isDuplicate && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800 whitespace-nowrap" title={`Also on ${providerCount - 1} other provider${providerCount > 2 ? 's' : ''}`}>
                📋 {providerCount}x
              </span>
            )}
          </div>
        </div>
      </td>
      {showProviderBadge && <td className="px-4 py-3"><div className="flex items-center gap-2 overflow-hidden"><span className="text-sm flex-shrink-0">{provider?.icon}</span><span className="text-[9px] font-black text-gray-400 uppercase truncate">{providerLabel(file)}</span></div></td>}
      <td className="px-4 py-3 text-[11px] font-medium text-gray-500">{file.isFolder ? '—' : formatBytes(file.size)}</td>
      <td className="px-4 py-3 text-[11px] font-medium text-gray-500 tabular-nums">{file.modifiedTime?.split('T')[0]}</td>
      <td className="px-4 py-3 relative"><button data-testid="cf-files-row-overflow" onClick={(e) => { e.stopPropagation(); setShowOverflow(!showOverflow) }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-400 transition-all font-bold">•••</button>
        {showOverflow && <> <div className="fixed inset-0 z-10" onClick={() => setShowOverflow(false)} /> <div className="absolute right-4 top-full z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"> <button onClick={() => { onOpen(file); setShowOverflow(false) }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold flex items-center gap-3"><span>👁️</span> Open</button> <button onClick={() => { onDownload(file); setShowOverflow(false) }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold flex items-center gap-3"><span>⬇️</span> Download</button> <div className="my-1 border-t border-gray-100 dark:border-gray-800" /> <button onClick={() => { onRename(file); setShowOverflow(false) }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold flex items-center gap-3"><span>✏️</span> Rename</button> <button onClick={() => { onMove(file); setShowOverflow(false) }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold flex items-center gap-3"><span>📦</span> Move</button> <button onClick={() => { onCopy(file); setShowOverflow(false) }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold flex items-center gap-3"><span>📄</span> Copy</button> <div className="my-1 border-t border-gray-100 dark:border-gray-800" /> <button onClick={() => { onDelete(file); setShowOverflow(false) }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold text-red-600 flex items-center gap-3"><span>🗑️</span> Delete</button> </div> </>}
      </td>
    </tr>
  )
}

function dateMsSafe(d?: string | null) { const ms = Date.parse(d || ''); return isNaN(ms) ? 0 : ms }
function providerLabel(f: FileMetadata) { return (f as any).sourceLabel || f.providerName || f.provider }
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
