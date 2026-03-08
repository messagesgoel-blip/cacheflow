/**
 * TransferItem Component
 *
 * Displays a single transfer with chunk-level progress visualization.
 * For large files (>50MB), shows individual chunk progress with committed
 * chunks highlighted and pending chunks dimmed.
 *
 * Gate: TRANSFER-1
 * Task: 3.7@TRANSFER-1
 */

'use client';

import React, { useMemo } from 'react';

export type TransferStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface TransferItemProps {
  /** Unique job identifier */
  jobId: string;
  /** File name to display */
  fileName: string;
  /** Total file size in bytes */
  fileSize: number;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Transfer status */
  status: TransferStatus;
  /** Error message if failed */
  error?: string;
  /** Current chunk index (0-based) for chunked uploads */
  currentChunk?: number;
  /** Total number of chunks for chunked uploads */
  totalChunks?: number;
  /** Array of committed chunk indices (for resume support) */
  committedChunks?: number[];
  /** Bytes transferred so far */
  bytesTransferred?: number;
  /** Operation type */
  operation?: 'upload' | 'download' | 'copy' | 'move' | 'delete' | 'rename';
  /** Source provider name */
  sourceProvider?: string;
  /** Destination provider name */
  destProvider?: string;
  /** Callback when user dismisses the item */
  onDismiss?: (jobId: string) => void;
  /** Callback when user retries a failed transfer */
  onRetry?: (jobId: string) => void;
  /** Callback when user cancels an active transfer */
  onCancel?: (jobId: string) => void;
}

/**
 * Format bytes to human-readable string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const itemTone = (status: TransferStatus): string => {
  switch (status) {
    case 'completed':
      return 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] text-[var(--cf-green)]';
    case 'failed':
      return 'border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] text-[var(--cf-red)]';
    case 'active':
      return 'border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] text-[var(--cf-blue)]';
    default:
      return 'border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] text-[var(--cf-text-1)]';
  }
};

/**
 * Get status icon emoji
 */
const getStatusIcon = (status: TransferStatus): string => {
  switch (status) {
    case 'active':
      return '⏳';
    case 'waiting':
      return '⏱️';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '📁';
  }
};

/**
 * Get status color class
 */
const getStatusColor = (status: TransferStatus): string => {
  switch (status) {
    case 'active':
      return 'bg-blue-500';
    case 'waiting':
      return 'bg-gray-400';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

/**
 * Get provider display name
 */
const getProviderDisplay = (source?: string, dest?: string): string => {
  if (!source && !dest) return '';
  if (source && dest) return `${source} → ${dest}`;
  return source || dest || '';
};

/**
 * Calculate chunk size from file size and total chunks
 */
const calculateChunkSize = (fileSize: number, totalChunks: number): number => {
  if (totalChunks === 0) return 0;
  return Math.ceil(fileSize / totalChunks);
};

/**
 * TransferItem Component
 *
 * Displays transfer progress with optional chunk-level visualization
 * for large files that use chunked uploads.
 */
export const TransferItem: React.FC<TransferItemProps> = ({
  jobId,
  fileName,
  fileSize,
  progress,
  status,
  error,
  currentChunk,
  totalChunks,
  committedChunks = [],
  bytesTransferred = 0,
  operation,
  sourceProvider,
  destProvider,
  onDismiss,
  onRetry,
  onCancel,
}) => {
  // Determine if this is a chunked upload (>50MB file or explicit chunk info)
  const isChunked = useMemo(() => {
    return (
      (totalChunks !== undefined && totalChunks > 1) ||
      (fileSize > 50 * 1024 * 1024) // 50MB threshold
    );
  }, [totalChunks, fileSize]);

  // Calculate inferred committed chunks from progress when explicit list not available
  const inferredCommittedChunks = useMemo(() => {
    if (!isChunked || !totalChunks || !progress) return [];

    // If we have explicit committed chunks, use those
    if (committedChunks && committedChunks.length > 0) {
      return committedChunks;
    }

    // Otherwise infer from progress - estimate which chunks are complete
    const estimatedCommitted = Math.floor((progress / 100) * totalChunks);
    return Array.from({ length: estimatedCommitted }, (_, i) => i);
  }, [isChunked, totalChunks, progress, committedChunks]);

  // Calculate the current uploading chunk (next one after committed)
  const inferredCurrentChunk = useMemo(() => {
    if (!isChunked || !totalChunks || progress === undefined) return undefined;

    // If we have explicit current chunk from context, use it
    if (currentChunk !== undefined) {
      return currentChunk;
    }

    // Infer from progress percentage
    return Math.floor((progress / 100) * totalChunks);
  }, [isChunked, totalChunks, progress, currentChunk]);

  // Generate chunk status array for visualization
  const chunkStatuses = useMemo(() => {
    if (!isChunked || !totalChunks) return [];

    return Array.from({ length: totalChunks }, (_, index) => {
      // Chunk is committed if it's in the explicit committedChunks array
      // OR if it's less than the inferred committed count
      const isCommitted = inferredCommittedChunks.includes(index);
      const isCurrent = inferredCurrentChunk !== undefined && index === inferredCurrentChunk;
      const isPending = !isCommitted && !isCurrent;

      return {
        index,
        isCommitted,
        isCurrent,
        isPending,
      };
    });
  }, [isChunked, totalChunks, inferredCommittedChunks, inferredCurrentChunk]);

  // Calculate bytes per chunk for display
  const bytesPerChunk = useMemo(() => {
    if (!totalChunks) return 0;
    return calculateChunkSize(fileSize, totalChunks);
  }, [fileSize, totalChunks]);

  // Committed bytes calculation
  const committedBytes = useMemo(() => {
    const chunksCount = inferredCommittedChunks.length;
    if (!chunksCount || !bytesPerChunk) return 0;
    return chunksCount * bytesPerChunk;
  }, [inferredCommittedChunks.length, bytesPerChunk]);

  const providerDisplay = getProviderDisplay(sourceProvider, destProvider);
  const operationDisplay = operation ? operation.charAt(0).toUpperCase() + operation.slice(1) : '';

  return (
    <div className="mb-2.5 rounded-[20px] border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] p-3.5 transition-colors hover:bg-[var(--cf-panel-soft)]">
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border text-sm ${itemTone(status)}`}>{getStatusIcon(status)}</span>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header: File name and operation */}
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[var(--cf-text-0)]" title={fileName}>
              {fileName}
            </p>
            {status === 'completed' && (
              <button
                onClick={() => onDismiss?.(jobId)}
                className="flex-shrink-0 text-xs text-[var(--cf-text-3)] hover:text-[var(--cf-text-1)]"
                aria-label="Dismiss"
              >
                ×
              </button>
            )}
            {status === 'failed' && onRetry && (
              <button
                onClick={() => onRetry(jobId)}
                className="flex-shrink-0 text-xs font-medium text-[var(--cf-blue)] hover:text-[var(--cf-text-0)]"
              >
                Retry
              </button>
            )}
            {(status === 'active' || status === 'waiting') && onCancel && (
              <button
                onClick={() => onCancel(jobId)}
                className="ml-2 flex-shrink-0 text-xs text-[var(--cf-text-2)] hover:text-[var(--cf-text-0)]"
                title="Cancel transfer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Metadata: Size and provider/operation */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--cf-text-2)]">
            <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1">{formatFileSize(fileSize)}</span>
            {providerDisplay && (
              <>
                <span className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1">{providerDisplay}</span>
              </>
            )}
            {operationDisplay && (
              <>
                <span className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1">{operationDisplay}</span>
              </>
            )}
          </div>

          {/* Chunked Progress Display */}
          {isChunked && totalChunks && totalChunks > 1 && (
            <div className="mt-2.5">
              {/* Chunk visualization */}
              <div className="mb-2 flex gap-0.5">
                {chunkStatuses.map((chunk, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      chunk.isCommitted
                        ? 'bg-[var(--cf-green)]'
                        : chunk.isCurrent
                        ? 'bg-[var(--cf-blue)] animate-pulse'
                        : 'bg-[var(--cf-bg3)]'
                    }`}
                    title={`Chunk ${idx + 1}/${totalChunks}${
                      chunk.isCommitted
                        ? ' (uploaded)'
                        : chunk.isCurrent
                        ? ' (uploading)'
                        : ' (pending)'
                    }`}
                  />
                ))}
              </div>

              {/* Chunk progress text */}
              <div className="mb-1 flex justify-between text-xs text-[var(--cf-text-2)]">
                <span>
                  {inferredCommittedChunks.length} of {totalChunks} chunks
                  {inferredCurrentChunk !== undefined && inferredCurrentChunk < totalChunks && ` (uploading ${inferredCurrentChunk + 1})`}
                </span>
                <span>{formatFileSize(committedBytes)} / {formatFileSize(fileSize)}</span>
              </div>
            </div>
          )}

          {/* Simple Progress Bar (for non-chunked transfers only) */}
          {(status === 'active' || status === 'waiting') && !isChunked && (
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-xs text-[var(--cf-text-2)]">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--cf-bg3)]">
                <div
                  className={`h-2 rounded-full transition-all ${getStatusColor(status)}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {bytesTransferred > 0 && (
                <p className="mt-1 text-xs text-[var(--cf-text-2)]">
                  {formatFileSize(bytesTransferred)} of {formatFileSize(fileSize)} transferred
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {status === 'failed' && error && (
            <p className="mt-2 rounded-xl border border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] px-3 py-2 text-xs text-[var(--cf-red)]">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferItem;
