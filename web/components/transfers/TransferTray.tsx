/**
 * Transfer Tray Component
 *
 * Shows ongoing and recent file transfers with progress.
 * Pinned to bottom-right of screen.
 * Uses TransferContext for global state management.
 * Always visible when there are active transfers.
 *
 * Gate: TRANSFER-1
 * Task: 3.1
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTransferContext, TransferItem as TransferItemType } from '../../context/TransferContext';
import { TransferItem } from './TransferItem';
import { formatBytes } from '@/lib/providers/types';

/**
 * TransferTray Component
 *
 * Persistent tray that shows file transfers. When collapsed and there are
 * active transfers, shows a floating button with badge. When expanded, shows all
 * active and recent transfers.
 *
 * Gate: TRANSFER-1
 * Task: 3.1
 */
export const TransferTray: React.FC = () => {
  const {
    transfers,
    activeCount,
    hasActiveTransfers,
    rateLimited,
    retryAfter,
    cancelTransfer,
    retryTransfer,
    dismissTransfer,
    refreshTransfers,
  } = useTransferContext();

  const [isOpen, setIsOpen] = useState(false);
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);

  // Countdown timer for rate limit
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (rateLimited && retryAfter) {
      setCountdown(retryAfter);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [rateLimited, retryAfter]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncPreviewPanel = () => {
      setPreviewPanelOpen(Boolean(document.querySelector('[data-testid="cf-preview-panel"]')));
    };

    syncPreviewPanel();

    const observer = new MutationObserver(syncPreviewPanel);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'class'],
    });

    window.addEventListener('resize', syncPreviewPanel);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncPreviewPanel);
    };
  }, []);

  const trayStyle = {
    right: previewPanelOpen ? '25rem' : '1rem',
  };

  // Separate active and completed transfers
  const { activeTransfers, completedTransfers } = useMemo(() => {
    const active = transfers.filter(
      (t): t is TransferItemType => t.status === 'active' || t.status === 'waiting'
    );
    const completed = transfers.filter(
      (t): t is TransferItemType => t.status === 'completed' || t.status === 'failed'
    );
    return {
      activeTransfers: active,
      completedTransfers: completed.slice(0, 5), // Keep last 5 completed
    };
  }, [transfers]);
  const totalBytes = useMemo(
    () => transfers.reduce((sum, transfer) => sum + (transfer.fileSize || 0), 0),
    [transfers],
  );

  // Handle cancel action
  const handleCancel = async (jobId: string) => {
    try {
      await cancelTransfer(jobId);
    } catch (error) {
      console.error('Failed to cancel transfer:', error);
    }
  };

  // Handle retry action
  const handleRetry = async (jobId: string) => {
    try {
      await retryTransfer(jobId);
    } catch (error) {
      console.error('Failed to retry transfer:', error);
    }
  };

  // Handle dismiss action
  const handleDismiss = (jobId: string) => {
    dismissTransfer(jobId);
  };

  // If tray is collapsed and there are no active transfers, show the collapsed button
  if (!isOpen && !hasActiveTransfers) {
    return (
      <button
        data-transfer-tray
        onClick={() => setIsOpen(true)}
        style={trayStyle}
        className={`cf-liquid fixed bottom-4 z-50 rounded-[24px] p-3 shadow-[var(--cf-shadow-strong)] transition-colors ${
          rateLimited
            ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.15)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.2)]'
            : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-panel-soft)] hover:text-[var(--cf-text-0)]'
        }`}
        aria-label={rateLimited ? `Rate limited, retry in ${countdown || retryAfter}s` : 'Show transfers'}
      >
        <span className="text-lg">⇅</span>
        {rateLimited && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b] text-xs text-white">
            !
          </span>
        )}
      </button>
    );
  }

  // If there are active transfers and tray is collapsed, show badge on button
  if (!isOpen && hasActiveTransfers) {
    return (
      <button
        data-transfer-tray
        onClick={() => setIsOpen(true)}
        style={trayStyle}
        className={`cf-liquid fixed bottom-4 z-50 rounded-[24px] p-2.5 shadow-[var(--cf-shadow-strong)] transition-colors ${
          rateLimited
            ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.15)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.2)]'
            : 'border-[rgba(74,158,255,0.26)] bg-[rgba(74,158,255,0.14)] text-[var(--cf-blue)] hover:bg-[rgba(74,158,255,0.18)]'
        }`}
        aria-label={rateLimited ? `Rate limited, ${activeCount} active, retry in ${countdown || retryAfter}s` : `${activeCount} active transfer${activeCount > 1 ? 's' : ''}`}
      >
        <div className="relative">
          <span className="text-lg">⇅</span>
          {rateLimited ? (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b] text-xs text-white">
              !
            </span>
          ) : activeCount > 0 ? (
            <span data-testid="activeBadge" className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--cf-red)] text-xs text-white">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          ) : null}
        </div>
      </button>
    );
  }

  // Tray is expanded
  return (
    <div
      data-transfer-tray
      data-testid="cf-transfer-tray"
      style={trayStyle}
      className="cf-liquid fixed bottom-4 z-50 w-[22rem] max-h-[32rem] overflow-hidden rounded-[30px] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-strong)]"
    >
      {/* Header */}
      <div className="cf-toolbar-card border-b border-[var(--cf-border)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="cf-kicker">Transfers</div>
            <h3 className="mt-1 text-sm font-semibold text-[var(--cf-text-0)]">Live transfer tray</h3>
            <p className="mt-1 text-xs text-[var(--cf-text-2)]">
              {formatBytes(totalBytes)} across {transfers.length} tracked jobs
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="cf-chip px-2 py-1 text-[10px] font-semibold">
                {activeCount} active
              </span>
            )}
            <button
              onClick={refreshTransfers}
              className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-2 text-[var(--cf-text-2)] transition-colors hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
              aria-label="Refresh transfers"
            >
              ↻
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="cf-panel rounded-[20px] px-3 py-2">
            <div className="cf-kicker text-[9px]">Active</div>
            <div className="mt-1 text-base font-semibold text-[var(--cf-blue)]">{activeTransfers.length}</div>
          </div>
          <div className="cf-panel rounded-[20px] px-3 py-2">
            <div className="cf-kicker text-[9px]">Done</div>
            <div className="mt-1 text-base font-semibold text-[var(--cf-green)]">
              {completedTransfers.filter((transfer) => transfer.status === 'completed').length}
            </div>
          </div>
          <div className="cf-panel rounded-[20px] px-3 py-2">
            <div className="cf-kicker text-[9px]">Failed</div>
            <div className="mt-1 text-base font-semibold text-[var(--cf-red)]">
              {completedTransfers.filter((transfer) => transfer.status === 'failed').length}
            </div>
          </div>
        </div>
        {/* Rate Limit Indicator */}
        {rateLimited && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(245,158,11,0.2)] text-sm">⚠</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#f59e0b]">Rate Limited</p>
              <p className="text-xs text-[var(--cf-text-2)]">
                Retry in {countdown !== null ? `${countdown}s` : `${retryAfter}s`}
              </p>
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-medium text-[var(--cf-text-1)] transition-colors hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
            aria-label="Minimize"
          >
            Minimize
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[24rem] overflow-y-auto px-3 py-3">
        {/* Active transfers */}
        {activeTransfers.length > 0 && (
          <>
            {activeTransfers.map((transfer) => (
              <TransferItem
                key={transfer.jobId}
                jobId={transfer.jobId}
                fileName={transfer.fileName}
                fileSize={transfer.fileSize}
                progress={transfer.progress}
                status={transfer.status}
                error={transfer.error}
                operation={transfer.operation}
                sourceProvider={transfer.sourceProvider}
                destProvider={transfer.destProvider}
                currentChunk={transfer.currentChunk}
                totalChunks={transfer.totalChunks}
                committedChunks={transfer.committedChunks}
                bytesTransferred={transfer.bytesTransferred}
                onCancel={handleCancel}
                onDismiss={handleDismiss}
              />
            ))}
          </>
        )}

        {/* Completed transfers */}
        {completedTransfers.length > 0 && (
          <>
            {activeTransfers.length > 0 && (
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--cf-text-3)]">
                Completed
              </div>
            )}
            {completedTransfers.map((transfer) => (
              <TransferItem
                key={transfer.jobId}
                jobId={transfer.jobId}
                fileName={transfer.fileName}
                fileSize={transfer.fileSize}
                progress={transfer.progress}
                status={transfer.status}
                error={transfer.error}
                operation={transfer.operation}
                sourceProvider={transfer.sourceProvider}
                destProvider={transfer.destProvider}
                onRetry={handleRetry}
                onDismiss={handleDismiss}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {activeTransfers.length === 0 && completedTransfers.length === 0 && (
          <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-6 text-center text-[var(--cf-text-2)]">
            <div className="cf-kicker mb-2">Queue</div>
            <p className="text-sm font-medium text-[var(--cf-text-1)]">No transfers</p>
            <p className="mt-1 text-xs">Transfer activity will appear here once a copy or move starts.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferTray;
