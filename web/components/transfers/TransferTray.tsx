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
        className="fixed bottom-4 p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors z-50"
        aria-label="Show transfers"
      >
        <span className="text-lg">📁</span>
      </button>
    );
  }

  // If there are active transfers and tray is collapsed, show badge on button
  if (!isOpen && hasActiveTransfers) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={trayStyle}
        className="fixed bottom-4 p-2 bg-blue-500 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-50"
        aria-label={`${activeCount} active transfer${activeCount > 1 ? 's' : ''}`}
      >
        <div className="relative">
          <span className="text-lg text-white">📁</span>
          {activeCount > 0 && (
            <span data-testid="activeBadge" className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
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
      className="fixed bottom-4 w-80 max-h-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Transfers</h3>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-xs text-gray-600">{activeCount} active</span>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label="Minimize"
          >
            −
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-80">
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
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
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
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm">No transfers</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferTray;

