'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface TransferItem {
  jobId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  operation?: 'copy' | 'move' | 'upload' | 'download' | 'delete' | 'rename';
  sourceProvider?: string;
  destProvider?: string;
  error?: string;
  toastMessage?: string;
  // Chunk-level progress for large file transfers (>50MB)
  currentChunk?: number;
  totalChunks?: number;
  committedChunks?: number[];
  bytesTransferred?: number;
}

export interface TransferContextValue {
  transfers: TransferItem[];
  activeCount: number;
  hasActiveTransfers: boolean;
  startTransfer: (options: TransferOptions) => Promise<string>;
  cancelTransfer: (jobId: string) => Promise<void>;
  retryTransfer: (jobId: string) => Promise<void>;
  dismissTransfer: (jobId: string) => void;
  refreshTransfers: () => Promise<void>;
}

export interface TransferOptions {
  sourceProvider: string;
  destProvider: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  sourceFolderId?: string;
  destFolderId?: string;
  operation: 'copy' | 'move' | 'upload' | 'download';
}

const TransferContext = createContext<TransferContextValue | null>(null);

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function TransferProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  /**
   * Start a new transfer via API
   */
  const startTransfer = useCallback(async (options: TransferOptions): Promise<string> => {
    const response = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to start transfer');
    }

    // Add to local state immediately
    const newTransfer: TransferItem = {
      jobId: result.jobId,
      fileName: options.fileName,
      fileSize: options.fileSize,
      progress: 0,
      status: 'waiting',
      operation: options.operation,
      sourceProvider: options.sourceProvider,
      destProvider: options.destProvider,
    };

    setTransfers(prev => [newTransfer, ...prev]);

    return result.jobId;
  }, []);

  /**
   * Cancel a transfer
   */
  const cancelTransfer = useCallback(async (jobId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/transfers/${jobId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setTransfers(prev => prev.filter(t => t.jobId !== jobId));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to cancel transfer:', error);
      throw error;
    }
  }, []);

  /**
   * Retry a failed transfer
   */
  const retryTransfer = useCallback(async (jobId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/transfers/${jobId}/retry`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setTransfers(prev => prev.map(t =>
          t.jobId === jobId
            ? { ...t, status: 'waiting', progress: 0, error: undefined }
            : t
        ));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to retry transfer:', error);
      throw error;
    }
  }, []);

  /**
   * Dismiss a completed/failed transfer from the list
   */
  const dismissTransfer = useCallback((jobId: string) => {
    setTransfers(prev => prev.filter(t => t.jobId !== jobId));
  }, []);

  /**
   * Refresh transfers from API
   */
  const refreshTransfers = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/transfers?limit=50');
      const result = await response.json();

      if (result.success) {
        // Merge server state with local state, preserving any local-only entries
        const serverTransfers: TransferItem[] = result.transfers || [];
        const localJobIds = new Set(transfers.map(t => t.jobId));
        const newLocalTransfers = transfers.filter(t => !serverTransfers.find(s => s.jobId === t.jobId));

        // Combine: server transfers + any local transfers not yet on server
        setTransfers([...serverTransfers, ...newLocalTransfers]);
      }
    } catch (error) {
      console.error('Failed to refresh transfers:', error);
    }
  }, [transfers]);

  // Connect to SSE for real-time progress updates
  useEffect(() => {
    const eventSources: Map<string, EventSource> = new Map();

    const connectToSSE = (transfer: TransferItem) => {
      if (eventSources.has(transfer.jobId)) return;
      if (transfer.status === 'completed' || transfer.status === 'failed') return;

      const es = new EventSource(`/api/transfers/${transfer.jobId}/progress`);

      es.addEventListener('connected', () => {
        // Initialize chunk tracking for large files
        const fileSize = transfer.fileSize;
        const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024; // 50MB
        const isLargeFile = fileSize > CHUNKED_UPLOAD_THRESHOLD;

        if (isLargeFile) {
          // Default chunk size based on provider
          let chunkSize = 5 * 1024 * 1024; // Default 5MB fallback
          if (transfer.sourceProvider === 'google') chunkSize = 8 * 1024 * 1024;
          else if (transfer.sourceProvider === 'onedrive') chunkSize = 10 * 1024 * 1024;
          else if (transfer.sourceProvider === 'dropbox') chunkSize = 150 * 1024 * 1024;

          const totalChunks = Math.ceil(fileSize / chunkSize);

          setTransfers(prev => prev.map(t =>
            t.jobId === transfer.jobId
              ? {
                  ...t,
                  status: 'active' as const,
                  totalChunks,
                  currentChunk: 0,
                  committedChunks: [],
                  bytesTransferred: 0,
                }
              : t
          ));
        } else {
          setTransfers(prev => prev.map(t =>
            t.jobId === transfer.jobId
              ? { ...t, status: 'active' as const }
              : t
          ));
        }
      });

      es.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        const eventJobId = data.jobId || transfer.jobId;

        // Calculate chunk progress for large files (>50MB)
        const fileSize = data.data?.fileSize || transfer.fileSize;
        const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024; // 50MB
        const isLargeFile = fileSize > CHUNKED_UPLOAD_THRESHOLD;

        // Default chunk size based on provider (Google: 8MB, OneDrive: 10MB, Dropbox: 150MB)
        let chunkSize = 5 * 1024 * 1024; // Default 5MB fallback
        if (data.data?.sourceProvider === 'google') chunkSize = 8 * 1024 * 1024;
        else if (data.data?.sourceProvider === 'onedrive') chunkSize = 10 * 1024 * 1024;
        else if (data.data?.sourceProvider === 'dropbox') chunkSize = 150 * 1024 * 1024;

        const totalChunks = Math.ceil(fileSize / chunkSize);
        const currentChunk = isLargeFile ? Math.floor((data.progress / 100) * totalChunks) : undefined;
        const bytesTransferred = Math.floor((data.progress / 100) * fileSize);

        setTransfers(prev => prev.map(t =>
          t.jobId === eventJobId
            ? {
                ...t,
                fileName: data.data?.fileName || t.fileName,
                fileSize: data.data?.fileSize || t.fileSize,
                operation: data.data?.operation || t.operation,
                sourceProvider: data.data?.sourceProvider || t.sourceProvider,
                destProvider: data.data?.destProvider || t.destProvider,
                progress: data.progress,
                status: data.status === 'completed' ? 'completed' as const :
                        data.status === 'failed' ? 'failed' as const :
                        data.status === 'active' ? 'active' as const :
                        t.status,
                error: data.error,
                // Chunk-level progress
                currentChunk: isLargeFile ? currentChunk : undefined,
                totalChunks: isLargeFile ? totalChunks : undefined,
                bytesTransferred,
              }
            : t
        ));
      });

      es.addEventListener('done', (event) => {
        const data = JSON.parse(event.data);
        setTransfers(prev => prev.map(t =>
          t.jobId === transfer.jobId
            ? {
                ...t,
                status: data.status === 'completed' ? 'completed' as const : 'failed' as const,
                progress: data.status === 'completed' ? 100 : t.progress,
              }
            : t
        ));
        es.close();
        eventSources.delete(transfer.jobId);
      });

      es.onerror = () => {
        es.close();
        eventSources.delete(transfer.jobId);
      };

      eventSources.set(transfer.jobId, es);
    };

    // Connect to SSE for active transfers
    transfers.forEach(transfer => {
      if (transfer.status === 'waiting' || transfer.status === 'active') {
        connectToSSE(transfer);
      }
    });

    return () => {
      eventSources.forEach(es => es.close());
      eventSources.clear();
    };
  }, [transfers]);

  // Poll for updates every 5 seconds as fallback
  useEffect(() => {
    const hasActiveTransfers = transfers.some(t => t.status === 'active' || t.status === 'waiting');

    if (!isPolling && hasActiveTransfers) {
      setIsPolling(true);
    }

    const interval = setInterval(() => {
      const hasActive = transfers.some(t => t.status === 'active' || t.status === 'waiting');
      if (hasActive) {
        refreshTransfers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [transfers, isPolling, refreshTransfers]);

  // Calculate active count
  const activeCount = transfers.filter(t => t.status === 'active' || t.status === 'waiting').length;
  const hasActiveTransfers = activeCount > 0;

  return (
    <TransferContext.Provider
      value={{
        transfers,
        activeCount,
        hasActiveTransfers,
        startTransfer,
        cancelTransfer,
        retryTransfer,
        dismissTransfer,
        refreshTransfers,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
}

export function useTransferContext() {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error('useTransferContext must be used within TransferProvider');
  }
  return context;
}

export { formatFileSize };
