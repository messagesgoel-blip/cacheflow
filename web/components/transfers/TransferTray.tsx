/**
 * Transfer Tray Component
 * 
 * Shows ongoing and recent file transfers with progress.
 * Pinned to bottom-right of screen.
 * 
 * Gate: TRANSFER-1
 * Task: 3.3@TRANSFER-1
 */

'use client';

import React, { useState, useEffect } from 'react';

export interface TransferItem {
  jobId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  error?: string;
}

export interface TransferTrayProps {
  transfers?: TransferItem[];
  onDismiss?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
}

export const TransferTray: React.FC<TransferTrayProps> = ({
  transfers = [],
  onDismiss,
  onRetry,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTransfers, setActiveTransfers] = useState<TransferItem[]>([]);
  const [completedTransfers, setCompletedTransfers] = useState<TransferItem[]>([]);

  useEffect(() => {
    if (!transfers) return;

    const active = transfers.filter(t => t.status === 'active' || t.status === 'waiting');
    const completed = transfers.filter(t => t.status === 'completed' || t.status === 'failed');

    setActiveTransfers(active);
    setCompletedTransfers(completed.slice(0, 5)); // Keep last 5
  }, [transfers]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '⏳';
      case 'waiting': return '⏱️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '📁';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500';
      case 'waiting': return 'bg-gray-400';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isOpen && activeTransfers.length === 0) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Show transfers"
      >
        📁
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 max-h-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Transfers</h3>
        <div className="flex items-center gap-2">
          {activeTransfers.length > 0 && (
            <span className="text-xs text-gray-600">{activeTransfers.length} active</span>
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
        {activeTransfers.map(transfer => (
          <div key={transfer.jobId} className="p-3 border-b border-gray-100">
            <div className="flex items-start gap-2">
              <span className="text-lg">{getStatusIcon(transfer.status)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{transfer.fileName}</p>
                <p className="text-xs text-gray-500">{formatFileSize(transfer.fileSize)}</p>
                
                {transfer.status === 'active' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{transfer.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getStatusColor(transfer.status)}`}
                        style={{ width: `${transfer.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {transfer.status === 'failed' && transfer.error && (
                  <p className="text-xs text-red-600 mt-1">{transfer.error}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Completed transfers */}
        {completedTransfers.map(transfer => (
          <div key={transfer.jobId} className="p-3 border-b border-gray-100 opacity-75">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getStatusIcon(transfer.status)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{transfer.fileName}</p>
                <p className="text-xs text-gray-500">{formatFileSize(transfer.fileSize)}</p>
              </div>
              {transfer.status === 'completed' && (
                <button
                  onClick={() => onDismiss?.(transfer.jobId)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
              {transfer.status === 'failed' && onRetry && (
                <button
                  onClick={() => onRetry(transfer.jobId)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        ))}

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
