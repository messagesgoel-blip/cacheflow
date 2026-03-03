/**
 * Favorites Error Card
 * 
 * Specialized error card for favorites operations.
 * 
 * Gate: HOLD-UI
 * Task: UI-P1-T05@HOLD-UI-2026-03-02
 */

'use client';

import React from 'react';
import { InlineErrorCard } from './InlineErrorCard';

export interface FavoritesErrorCardProps {
  /** Operation that failed */
  operation?: 'add' | 'remove' | 'load';
  /** Item name (file/folder) */
  itemName?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Dismiss callback */
  onDismiss?: () => void;
}

export const FavoritesErrorCard: React.FC<FavoritesErrorCardProps> = ({
  operation = 'add',
  itemName,
  onRetry,
  onDismiss,
}) => {
  const getTitle = () => {
    switch (operation) {
      case 'add':
        return 'Failed to Add to Favorites';
      case 'remove':
        return 'Failed to Remove from Favorites';
      case 'load':
        return 'Failed to Load Favorites';
    }
  };

  const getMessage = () => {
    if (itemName) {
      switch (operation) {
        case 'add':
          return `Unable to add "${itemName}" to favorites. Please try again.`;
        case 'remove':
          return `Unable to remove "${itemName}" from favorites. Please try again.`;
        case 'load':
          return 'Unable to load your favorites. Please try again.';
      }
    }
    
    switch (operation) {
      case 'add':
        return 'Unable to add item to favorites. Please try again.';
      case 'remove':
        return 'Unable to remove item from favorites. Please try again.';
      case 'load':
        return 'Unable to load favorites. Please try again.';
    }
  };

  return (
    <InlineErrorCard
      type="favorites"
      title={getTitle()}
      message={getMessage()}
      onRetry={onRetry}
      onDismiss={onDismiss}
    />
  );
};

export default FavoritesErrorCard;
