/**
 * Inline Error Card Component
 * 
 * Displays actionable error messages for sync/proxy/favorites operations.
 * Includes retry button and toast notification.
 * 
 * Gate: HOLD-UI
 * Task: UI-P1-T05@HOLD-UI-2026-03-02
 */

'use client';

import React from 'react';

export interface InlineErrorCardProps {
  /** Error title */
  title: string;
  /** Error message with actionable copy */
  message: string;
  /** Error type for styling */
  type?: 'sync' | 'proxy' | 'favorites' | 'generic';
  /** Retry callback */
  onRetry?: () => void;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Additional action (e.g., "Go to Settings") */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const InlineErrorCard: React.FC<InlineErrorCardProps> = ({
  title,
  message,
  type = 'generic',
  onRetry,
  onDismiss,
  action,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'sync':
        return '🔄';
      case 'proxy':
        return '🔗';
      case 'favorites':
        return '⭐';
      default:
        return '⚠️';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'sync':
        return 'border-orange-300';
      case 'proxy':
        return 'border-red-300';
      case 'favorites':
        return 'border-yellow-300';
      default:
        return 'border-gray-300';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'sync':
        return 'bg-orange-50';
      case 'proxy':
        return 'bg-red-50';
      case 'favorites':
        return 'bg-yellow-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div 
      className={`p-4 rounded-lg border ${getBorderColor()} ${getBgColor()} shadow-sm`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">{getIcon()}</span>
        
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-700 mb-3">{message}</p>
          
          <div className="flex items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
              >
                Retry
              </button>
            )}
            
            {action && (
              <button
                onClick={action.onClick}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                {action.label}
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InlineErrorCard;
