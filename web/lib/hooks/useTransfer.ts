/**
 * useTransfer Hook
 * 
 * Manages async file transfers with toast notifications.
 * Every file operation produces a tray entry + toast.
 * 
 * Gate: TRANSFER-1
 * Task: 3.3@TRANSFER-1
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './useToast';
import { TransferItem } from '../../context/TransferContext';

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

export interface UseTransferReturn {
  /** Start a transfer */
  startTransfer: (options: TransferOptions) => Promise<string>;
  /** Cancel a transfer */
  cancelTransfer: (jobId: string) => Promise<void>;
  /** Retry a failed transfer */
  retryTransfer: (jobId: string) => Promise<void>;
  /** Get all transfers */
  transfers: TransferItem[];
  /** Get active transfers count */
  activeCount: number;
  /** Refresh transfers list */
  refresh: () => Promise<void>;
  /** Dismiss completed transfer */
  dismissTransfer: (jobId: string) => void;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * useTransfer hook
 */
export function useTransfer(): UseTransferReturn {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const toast = useToast();

  /**
   * Start a new transfer
   */
  const startTransfer = useCallback(async (options: TransferOptions): Promise<string> => {
    try {
      // Show initial toast
      toast.info(
        `Starting ${options.operation} of "${options.fileName}"`,
        'Transfer Queued'
      );

      // Create transfer job
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start transfer');
      }

      // Add to local state
      const newTransfer: TransferItem = {
        jobId: result.jobId,
        fileName: options.fileName,
        fileSize: options.fileSize,
        progress: 0,
        status: 'waiting',
      };

      setTransfers(prev => [newTransfer, ...prev]);

      // Show success toast
      toast.success(
        `${formatFileSize(options.fileSize)} - ${options.operation} started`,
        'Transfer Started'
      );

      return result.jobId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(errorMessage, 'Transfer Failed');
      throw error;
    }
  }, [toast]);

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
        toast.success('Transfer cancelled', 'Cancelled');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to cancel transfer', 'Error');
    }
  }, [toast]);

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
        toast.success('Transfer restarted', 'Retrying');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to retry transfer', 'Error');
    }
  }, [toast]);

  /**
   * Refresh transfers list
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/transfers?limit=50');
      const result = await response.json();

      if (result.success) {
        setTransfers(result.transfers);
      }
    } catch (error) {
      console.error('Failed to refresh transfers:', error);
    }
  }, []);

  /**
   * Dismiss completed transfer
   */
  const dismissTransfer = useCallback((jobId: string) => {
    setTransfers(prev => prev.filter(t => t.jobId !== jobId));
  }, []);

  // Auto-refresh transfers every 5 seconds
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Calculate active count
  const activeCount = transfers.filter(t => t.status === 'active' || t.status === 'waiting').length;

  return {
    startTransfer,
    cancelTransfer,
    retryTransfer,
    transfers,
    activeCount,
    refresh,
    dismissTransfer,
  };
}

export default useTransfer;
