/**
 * Toast API for UI notifications
 * Provides consistent toast functionality across the application
 */

import { useToast } from '../hooks/useToast';

// Re-export the toast API for direct import
export { useToast };

// Also provide a direct toast object with the same API
const toast = {
  success: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const { success } = useToast();
    success(message);
    // Additional options handling would be implemented in the actual hook
  },
  error: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const { error } = useToast();
    error(message);
    // Additional options handling would be implemented in the actual hook
  },
  info: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const { info } = useToast();
    info(message);
    // Additional options handling would be implemented in the actual hook
  },
  warning: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const { warning } = useToast();
    warning(message);
    // Additional options handling would be implemented in the actual hook
  }
};

export default toast;
