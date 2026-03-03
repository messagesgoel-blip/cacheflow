/**
 * useOperationError Hook
 * 
 * Provides error handling for sync/proxy/favorites operations.
 * Returns error state, inline error card props, and toast helpers.
 * 
 * Gate: HOLD-UI
 * Task: UI-P1-T05@HOLD-UI-2026-03-02
 */

import { useState, useCallback } from 'react';
import { useToast } from './useToast';

export type OperationType = 'sync' | 'proxy' | 'favorites' | 'upload' | 'download';

export interface OperationError {
  type: OperationType;
  title: string;
  message: string;
  code?: string;
  requiresReauth?: boolean;
  retryable?: boolean;
  originalError?: any;
}

export interface UseOperationErrorReturn {
  /** Current error state */
  error: OperationError | null;
  /** Set error state */
  setError: (error: OperationError | null) => void;
  /** Clear error state */
  clearError: () => void;
  /** Handle error with toast and state */
  handleError: (error: any, operationType: OperationType) => void;
  /** Get props for InlineErrorCard */
  getErrorCardProps: () => {
    title: string;
    message: string;
    type: OperationType;
    onRetry?: () => void;
    onDismiss: () => void;
    action?: { label: string; onClick: () => void };
  } | null;
}

/**
 * Get user-friendly error message based on error type
 */
function getErrorMessage(error: any, operationType: OperationType): { title: string; message: string } {
  // Authentication errors
  if (error?.requiresReauth || error?.code === 'AUTH_EXPIRED' || error?.status === 401) {
    return {
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in again to continue.',
    };
  }

  // Network errors
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('fetch')) {
    return {
      title: 'Connection Issue',
      message: 'Unable to connect. Please check your internet connection and try again.',
    };
  }

  // Proxy errors
  if (operationType === 'proxy') {
    return {
      title: 'Provider Connection Failed',
      message: error?.message || 'Unable to connect to the storage provider. Please try again.',
    };
  }

  // Sync errors
  if (operationType === 'sync') {
    return {
      title: 'Sync Failed',
      message: error?.message || 'Unable to sync files. Please try again.',
    };
  }

  // Favorites errors
  if (operationType === 'favorites') {
    return {
      title: 'Favorites Update Failed',
      message: error?.message || 'Unable to update favorites. Please try again.',
    };
  }

  // Generic error
  return {
    title: 'Operation Failed',
    message: error?.message || 'An unexpected error occurred. Please try again.',
  };
}

/**
 * useOperationError hook
 */
export function useOperationError(operationType: OperationType): UseOperationErrorReturn {
  const [error, setError] = useState<OperationError | null>(null);
  const toast = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: any, type: OperationType) => {
    const { title, message } = getErrorMessage(error, type);

    // Create error state
    const operationError: OperationError = {
      type,
      title,
      message,
      code: error?.code,
      requiresReauth: error?.requiresReauth,
      retryable: error?.retryable !== false, // Default to retryable
      originalError: error,
    };

    setError(operationError);

    // Show toast notification
    if (error?.requiresReauth) {
      toast.error(message, title);
    } else {
      toast.error(message, title);
    }
  }, [toast]);

  const getErrorCardProps = useCallback(() => {
    if (!error) return null;

    return {
      title: error.title,
      message: error.message,
      type: error.type,
      onRetry: error.retryable ? () => {
        clearError();
        // Caller should handle retry logic
      } : undefined,
      onDismiss: clearError,
      action: error.requiresReauth ? {
        label: 'Sign In',
        onClick: () => {
          window.location.href = '/login?reason=session_expired';
        },
      } : undefined,
    };
  }, [error, clearError]);

  return {
    error,
    setError,
    clearError,
    handleError,
    getErrorCardProps,
  };
}

/**
 * useSyncError - Specialized hook for sync operations
 */
export function useSyncError() {
  return useOperationError('sync');
}

/**
 * useProxyError - Specialized hook for proxy operations
 */
export function useProxyError() {
  return useOperationError('proxy');
}

/**
 * useFavoritesError - Specialized hook for favorites operations
 */
export function useFavoritesError() {
  return useOperationError('favorites');
}
