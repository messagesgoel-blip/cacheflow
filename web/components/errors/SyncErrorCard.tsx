/**
 * Sync Error Card
 * 
 * Specialized error card for sync operations.
 * 
 * Gate: HOLD-UI
 * Task: UI-P1-T05@HOLD-UI-2026-03-02
 */

'use client';

import React from 'react';
import { InlineErrorCard, InlineErrorCardProps } from './InlineErrorCard';

export interface SyncErrorCardProps extends Omit<InlineErrorCardProps, 'type'> {
  /** Sync operation that failed */
  operation?: 'refresh' | 'initial-load' | 'background-sync';
}

export const SyncErrorCard: React.FC<SyncErrorCardProps> = ({
  operation = 'refresh',
  title,
  message,
  ...rest
}) => {
  const getDefaultTitle = () => {
    switch (operation) {
      case 'initial-load':
        return 'Failed to Load Files';
      case 'background-sync':
        return 'Background Sync Failed';
      default:
        return 'Sync Failed';
    }
  };

  const getDefaultMessage = () => {
    switch (operation) {
      case 'initial-load':
        return message || 'Unable to load your files. Please try again.';
      case 'background-sync':
        return message || 'Background sync encountered an error. Your files may be out of date.';
      default:
        return message || 'Unable to sync files. Please try again.';
    }
  };

  return (
    <InlineErrorCard
      {...rest}
      type="sync"
      title={title || getDefaultTitle()}
      message={getDefaultMessage()}
    />
  );
};

export default SyncErrorCard;
