'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

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
  rateLimited: boolean;
  retryAfter: number | null;
  rateLimitExpiry: number | null;
  startTransfer: (options: TransferOptions) => Promise<string>;
  cancelTransfer: (jobId: string) => Promise<void>;
  retryTransfer: (jobId: string) => Promise<void>;
  dismissTransfer: (jobId: string) => void;
  refreshTransfers: () => Promise<void>;
  clearRateLimit: () => void;
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [rateLimitExpiry, setRateLimitExpiry] = useState<number | null>(null);
  const rateLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clear rate limit state
   */
  const clearRateLimit = useCallback(() => {
    if (rateLimitTimeoutRef.current) {
      clearTimeout(rateLimitTimeoutRef.current);
      rateLimitTimeoutRef.current = null;
    }
    setRateLimited(false);
    setRetryAfter(null);
    setRateLimitExpiry(null);
  }, []);

  /**
   * Handle rate limit (429) response
   */
  const handleRateLimit = useCallback((response: Response): boolean => {
    if (response.status === 429) {
      // Cancel any previous backoff timer before scheduling a new one
      if (rateLimitTimeoutRef.current) {
        clearTimeout(rateLimitTimeoutRef.current);
        rateLimitTimeoutRef.current = null;
      }

      const retryAfterHeader = response.headers.get('Retry-After');
      let seconds = 60;
      let expiryTime: number;

      if (retryAfterHeader) {
        // Try to parse as HTTP-date (e.g., "Wed, 02 Apr 2025 14:00:00 GMT")
        const httpDate = Date.parse(retryAfterHeader);
        if (!isNaN(httpDate)) {
          // Calculate seconds until the HTTP-date
          seconds = Math.max(1, Math.ceil((httpDate - Date.now()) / 1000));
          expiryTime = Math.floor(httpDate / 1000);
        } else {
          // Try to parse as delta-seconds
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed) && parsed > 0) {
            seconds = parsed;
            expiryTime = Math.floor(Date.now() / 1000) + seconds;
          } else {
            // Default to 60 seconds
            expiryTime = Math.floor(Date.now() / 1000) + 60;
          }
        }
      } else {
        expiryTime = Math.floor(Date.now() / 1000) + 60;
      }

      setRateLimited(true);
      setRetryAfter(seconds);
      setRateLimitExpiry(expiryTime);
      // Auto-clear after retry interval
      rateLimitTimeoutRef.current = setTimeout(() => {
        setRateLimited(false);
        setRetryAfter(null);
        setRateLimitExpiry(null);
        rateLimitTimeoutRef.current = null;
      }, seconds * 1000);
      return true;
    }
    return false;
  }, []);

  /**
   * Start a new transfer via API
   */
  const startTransfer = useCallback(async (options: TransferOptions): Promise<string> => {
    // Check if rate limited before making request
    if (rateLimited) {
      throw new Error('Rate limited. Please wait before starting new transfers.');
    }

    const response = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      credentials: 'include',
    });

    // Check for rate limiting
    if (handleRateLimit(response)) {
      throw new Error('Rate limited. Please wait before starting new transfers.');
    }

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
  }, [handleRateLimit, rateLimited]);

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

      // Check for rate limiting before parsing JSON
      if (handleRateLimit(response)) {
        throw new Error('Rate limited. Please wait before retrying.');
      }

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
  }, [handleRateLimit]);

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
    // Skip if rate limited
    if (rateLimited) {
      return;
    }

    try {
      const response = await fetch('/api/transfers?limit=50', {
        credentials: 'include',
      });
      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      // Check for rate limiting
      if (handleRateLimit(response)) {
        return;
      }
      const result = await response.json();

      if (result.success) {
        // Merge server state with local state, preserving any local-only entries
        // Use functional updater to avoid adding transfers to dependency array
        setTransfers(prev => {
          const serverTransfers: TransferItem[] = result.transfers || [];
          const newLocalTransfers = prev.filter(t => !serverTransfers.find(s => s.jobId === t.jobId));
          // Combine: server transfers + any local transfers not yet on server
          return [...serverTransfers, ...newLocalTransfers];
        });
      }
    } catch (error) {
      console.error('Failed to refresh transfers:', error);
    }
  }, [handleRateLimit, rateLimited]);

  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const isPublicPath =
      pathname === '/login' ||
      pathname === '/register' ||
      pathname.startsWith('/auth/');

    if (isPublicPath) {
      setIsAuthenticated(false);
      setAuthChecked(true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (cancelled) return;
        if (!response.ok) {
          setIsAuthenticated(false);
          setAuthChecked(true);
          return;
        }

        const session = await response.json().catch(() => ({}));
        setIsAuthenticated(Boolean(session?.authenticated || session?.success || session?.user));
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Connect to SSE for real-time progress updates
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;

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
                        data.status === 'waiting' ? 'waiting' as const :
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

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;

    fetch('/api/transfers?limit=50')
      .then(r => r.json())
      .then(data => {
        if (data.transfers?.length) {
          setTransfers(prev => {
            const existingIds = new Set(prev.map(t => t.jobId))
            const newTransfers = data.transfers.filter(
              (t: TransferItem) => !existingIds.has(t.jobId)
            )
            return [...prev, ...newTransfers]
          })
        }
      })
      .catch(() => {})
  }, [authChecked, isAuthenticated])
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;

    if (transfers.length === 0) {
      fetch('/api/transfers?limit=50')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.transfers?.length) {
            setTransfers(prev => {
              const existingIds = new Set(prev.map(t => t.jobId))
              const newTransfers = data.transfers.filter(
                (t: TransferItem) => !existingIds.has(t.jobId)
              )
              return [...prev, ...newTransfers]
            })
          }
        })
        .catch(() => {})
    }
  }, [pathname, transfers, authChecked, isAuthenticated])

  // Poll for updates every 5 seconds as fallback
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;

    // Don't poll if rate limited
    if (rateLimited) {
      return;
    }

    const hasActiveTransfers = transfers.some(t => t.status === 'active' || t.status === 'waiting');

    if (!isPolling && hasActiveTransfers) {
      setIsPolling(true);
    }

    const interval = setInterval(() => {
      // Don't poll if rate limited
      if (rateLimited) {
        return;
      }
      const hasActive = transfers.some(t => t.status === 'active' || t.status === 'waiting');
      if (hasActive) {
        refreshTransfers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [transfers, isPolling, refreshTransfers, authChecked, isAuthenticated, rateLimited]);

  // Cleanup rate limit timeout on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimeoutRef.current) {
        clearTimeout(rateLimitTimeoutRef.current);
        rateLimitTimeoutRef.current = null;
      }
    };
  }, []);

  // Calculate active count
  const activeCount = transfers.filter(t => t.status === 'active' || t.status === 'waiting').length;
  const hasActiveTransfers = activeCount > 0;

  return (
    <TransferContext.Provider
      value={{
        transfers,
        activeCount,
        hasActiveTransfers,
        rateLimited,
        retryAfter,
        rateLimitExpiry,
        startTransfer,
        cancelTransfer,
        retryTransfer,
        dismissTransfer,
        refreshTransfers,
        clearRateLimit,
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
