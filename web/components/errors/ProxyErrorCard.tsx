/**
 * Proxy Error Card
 * 
 * Specialized error card for proxy operations (provider API calls).
 * 
 * Gate: HOLD-UI
 * Task: UI-P1-T05@HOLD-UI-2026-03-02
 */

'use client';

import React from 'react';
import { InlineErrorCard } from './InlineErrorCard';

export interface ProxyErrorCardProps {
  /** Provider name */
  providerName?: string;
  /** Operation that failed */
  operation?: 'list' | 'upload' | 'download' | 'delete' | 'move';
  /** Retry callback */
  onRetry?: () => void;
  /** Dismiss callback */
  onDismiss?: () => void;
}

export const ProxyErrorCard: React.FC<ProxyErrorCardProps> = ({
  providerName,
  operation = 'list',
  onRetry,
  onDismiss,
}) => {
  const getTitle = () => {
    if (providerName) {
      switch (operation) {
        case 'upload':
          return `Upload to ${providerName} Failed`;
        case 'download':
          return `Download from ${providerName} Failed`;
        case 'delete':
          return `Delete from ${providerName} Failed`;
        case 'move':
          return `Move in ${providerName} Failed`;
        default:
          return `${providerName} Connection Failed`;
      }
    }
    return 'Provider Connection Failed';
  };

  const getMessage = () => {
    if (providerName) {
      switch (operation) {
        case 'upload':
          return `Unable to upload files to ${providerName}. Please check your connection and try again.`;
        case 'download':
          return `Unable to download from ${providerName}. Please check your connection and try again.`;
        case 'delete':
          return `Unable to delete from ${providerName}. Please try again.`;
        case 'move':
          return `Unable to move files in ${providerName}. Please try again.`;
        default:
          return `Unable to connect to ${providerName}. Please check your credentials and try again.`;
      }
    }
    return 'Unable to connect to the storage provider. Please check your connection and try again.';
  };

  return (
    <InlineErrorCard
      type="proxy"
      title={getTitle()}
      message={getMessage()}
      onRetry={onRetry}
      onDismiss={onDismiss}
      action={{
        label: 'Reconnect Provider',
        onClick: () => {
          window.location.href = '/cloud-drives';
        },
      }}
    />
  );
};

export default ProxyErrorCard;
