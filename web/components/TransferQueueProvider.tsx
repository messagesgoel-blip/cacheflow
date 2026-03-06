'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { TransferJob, FileMetadata, ProviderId } from '@/lib/providers/types'
import { transferFileBetweenProviders } from '@/lib/transfer/crossProvider'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { metadataCache } from '@/lib/metadataCache'
import { useActionCenter } from './ActionCenterProvider'

interface TransferQueueContextType {
  queue: TransferJob[]
  addTransfer: (params: {
    type: 'copy' | 'move',
    file: FileMetadata,
    targetProviderId: ProviderId,
    targetAccountKey: string,
    targetFolderId: string
  }) => void
  retryTransfer: (id: string) => void
  dismissTransfer: (id: string) => void
  clearCompleted: () => void
}

const TransferQueueContext = createContext<TransferQueueContextType | null>(null)

export function useTransferQueue() {
  const ctx = useContext(TransferQueueContext)
  if (!ctx) throw new Error('useTransferQueue must be used within TransferQueueProvider')
  return ctx
}

export function TransferQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<TransferJob[]>([])
  const actions = useActionCenter()
  const queueRef = useRef<TransferJob[]>([])

  // Keep ref in sync for callbacks
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  const updateJob = useCallback((id: string, patch: Partial<TransferJob>) => {
    setQueue(prev => prev.map(job => 
      job.id === id ? { ...job, ...patch } : job
    ))
  }, [])

  const executeTransfer = useCallback(async (job: TransferJob, targetAccountKey: string, targetFolderId: string) => {
    updateJob(job.id, { status: 'transferring', startedAt: Date.now() })
    
    try {
      if ((job.sourceFile as any).accountKey) {
        tokenManager.setActiveToken(job.sourceProvider, (job.sourceFile as any).accountKey)
      }
      if (targetAccountKey) {
        tokenManager.setActiveToken(job.targetProvider, targetAccountKey)
      }

      const source = getProvider(job.sourceProvider)
      const target = getProvider(job.targetProvider)
      
      if (!source || !target) throw new Error('Provider not available')

      source.remoteId = (job.sourceFile as any).remoteId
      const targetToken = tokenManager.getToken(job.targetProvider, targetAccountKey)
      target.remoteId = (targetToken as any)?.remoteId

      await transferFileBetweenProviders({
        source,
        target,
        file: job.sourceFile,
        targetFolderId,
        mode: job.type === 'move' ? 'move' : 'copy',
        onProgress: (p) => {
          updateJob(job.id, { progress: p.percent, bytesTransferred: p.loaded, totalBytes: p.total })
        }
      })

      updateJob(job.id, { status: 'completed', progress: 100, completedAt: Date.now() })

      const sourceAccountKey = (job.sourceFile as any).accountKey || ''
      await Promise.allSettled([
        metadataCache.invalidateCache(job.sourceProvider, sourceAccountKey),
        metadataCache.invalidateCache(job.targetProvider, targetAccountKey),
      ])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cacheflow:transfer-complete', {
          detail: {
            jobId: job.id,
            sourceProvider: job.sourceProvider,
            targetProvider: job.targetProvider,
            sourceAccountKey,
            targetAccountKey,
            type: job.type,
            fileId: job.sourceFile.id,
          },
        }))
      }
      
      // Auto-dismiss completed after 60s
      setTimeout(() => {
        setQueue(prev => prev.filter(j => j.id !== job.id || j.status !== 'completed'))
      }, 60000)

    } catch (err: any) {
      console.error('[TransferQueue] job failed:', err)
      updateJob(job.id, { status: 'failed', error: err.message })
      actions.notify({ kind: 'error', title: 'Transfer Failed', message: job.sourceFile.name })
    }
  }, [updateJob, actions])

  const addTransfer = useCallback(({ type, file, targetProviderId, targetAccountKey, targetFolderId }: any) => {
    const id = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const newJob: TransferJob & { targetAccountKey: string } = {
      id,
      type,
      sourceProvider: file.provider,
      targetProvider: targetProviderId,
      sourceFile: file,
      targetPath: targetFolderId, // We store folderId here
      targetAccountKey,
      status: 'pending',
      progress: 0,
      bytesTransferred: 0,
      totalBytes: file.size,
      startedAt: Date.now()
    }

    setQueue(prev => [...prev, newJob])
    executeTransfer(newJob, targetAccountKey, targetFolderId)
  }, [executeTransfer])

  const retryTransfer = useCallback((id: string) => {
    const job = queueRef.current.find(j => j.id === id)
    if (!job || job.status !== 'failed') return
    
    // We'd need to re-capture accountKey and folderId or store them in job
    // For now we'll assume they are in the job metadata if we added it
    const targetAccountKey = (job as any).targetAccountKey
    const targetFolderId = job.targetPath
    
    executeTransfer(job, targetAccountKey, targetFolderId)
  }, [executeTransfer])

  const dismissTransfer = useCallback((id: string) => {
    setQueue(prev => prev.filter(job => job.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(job => job.status !== 'completed'))
  }, [])

  const value = useMemo(() => ({
    queue,
    addTransfer,
    retryTransfer,
    dismissTransfer,
    clearCompleted
  }), [queue, addTransfer, retryTransfer, dismissTransfer, clearCompleted])

  return (
    <TransferQueueContext.Provider value={value}>
      {children}
    </TransferQueueContext.Provider>
  )
}
