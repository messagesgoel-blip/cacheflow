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

import React, { useState, useMemo } from 'react';
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
    cancelTransfer,
    retryTransfer,
    dismissTransfer,
    refreshTransfers,
  } = useTransferContext();

  const [isOpen, setIsOpen] = useState(false);
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);

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
        onClick={() => setIsOpen(true)}
        style={trayStyle}
        className="fixed bottom-4 z-50 rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] p-3 text-[var(--cf-text-1)] shadow-[var(--cf-shadow-strong)] transition-colors hover:bg-[var(--cf-panel-soft)] hover:text-[var(--cf-text-0)]"
        aria-label="Show transfers"
      >
        <span className="text-lg">⇅</span>
      </button>
    );
  }

  // If there are active transfers and tray is collapsed, show badge on button
  if (!isOpen && hasActiveTransfers) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={trayStyle}
        className="fixed bottom-4 z-50 rounded-2xl border border-[rgba(74,158,255,0.26)] bg-[rgba(74,158,255,0.14)] p-2.5 text-[var(--cf-blue)] shadow-[var(--cf-shadow-strong)] transition-colors hover:bg-[rgba(74,158,255,0.18)]"
        aria-label={`${activeCount} active transfer${activeCount > 1 ? 's' : ''}`}
      >
        <div className="relative">
          <span className="text-lg">⇅</span>
          {activeCount > 0 && (
            <span data-testid="activeBadge" className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--cf-red)] text-xs text-white">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </div>
      </button>
    );
  }

  // Tray is expanded
  return (
    <div 
      data-testid="cf-transfer-tray"
      style={trayStyle}
      className="fixed bottom-4 z-50 w-[22rem] max-h-[32rem] overflow-hidden rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-strong)]"
    >
      {/* Header */}
      <div className="border-b border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-4">
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
              <span className="rounded-full border border-[var(--cf-border)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)]">
                {activeCount} active
              </span>
            )}
            <button
              onClick={refreshTransfers}
              className="rounded-xl border border-[var(--cf-border)] p-2 text-[var(--cf-text-2)] transition-colors hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
              aria-label="Refresh transfers"
            >
              ↻
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.1)] px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)]">Active</div>
            <div className="mt-1 text-base font-semibold text-[var(--cf-blue)]">{activeTransfers.length}</div>
          </div>
          <div className="rounded-2xl border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.1)] px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)]">Done</div>
            <div className="mt-1 text-base font-semibold text-[var(--cf-green)]">
              {completedTransfers.filter((transfer) => transfer.status === 'completed').length}
            </div>
          </div>
          <div className="rounded-2xl border border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)]">Failed</div>
            <div className="mt-1 text-base font-semibold text-[var(--cf-red)]">
              {completedTransfers.filter((transfer) => transfer.status === 'failed').length}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-xl border border-[var(--cf-border)] px-3 py-1.5 text-xs font-medium text-[var(--cf-text-1)] transition-colors hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
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
              <div className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
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
          <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-8 text-center text-[var(--cf-text-2)]">
            <p className="text-sm">No transfers</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferTray;
