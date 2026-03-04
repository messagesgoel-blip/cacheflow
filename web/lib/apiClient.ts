/**
 * CacheFlow API Client
 * 
 * Centralized HTTP client with:
 * - Auth interceptor for automatic token refresh
 * - Request/response logging (dev mode)
 * - Error normalization
 * - Type-safe API methods
 * 
 * Gate: AUTH-1, AUTH-4
 * Task: 1.1@AUTH-1
 */

import { authInterceptor, authFetch } from './interceptors/authInterceptor';

// API base paths
export const API_BASES = {
  remotes: '/api/remotes',
  auth: '/api/auth',
  files: '/api/files',
  tokens: '/api/tokens',
  admin: '/api/admin',
  transfers: '/api/transfers',
} as const;

// Common response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RemoteFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  isFolder: boolean;
  provider: string;
}

export interface ProviderConnection {
  id: string;
  provider: string;
  accountKey?: string;
  remoteId?: string;
  accountName: string;
  accountEmail?: string;
  accountLabel?: string;
  isDefault?: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
}

/**
 * Generic API client methods
 */
export const apiClient = {
  /**
   * GET request with auth interception
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await authInterceptor(`${API_BASES.remotes}${endpoint}`, {
        method: 'GET',
        ...options,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * POST request with auth interception
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await authInterceptor(`${API_BASES.remotes}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * DELETE request with auth interception
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await authInterceptor(`${API_BASES.remotes}${endpoint}`, {
        method: 'DELETE',
        ...options,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Fetch files from a remote provider
   */
  async getFiles(remoteId: string, path = ''): Promise<ApiResponse<RemoteFile[]>> {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.get<RemoteFile[]>(`/${remoteId}/files${query}`);
  },

  /**
   * Get provider connection health
   */
  async getHealth(remoteId: string): Promise<ApiResponse<{ status: string; healthy: boolean }>> {
    return this.get(`/${remoteId}/health`);
  },

  /**
   * List all provider connections
   */
  async getConnections(): Promise<ApiResponse<ProviderConnection[]>> {
    try {
      // Use authFetch which handles cookies automatically (HttpOnly)
      const response = await authFetch('/api/connections');

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const payload = await response.json();
      const connections = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      return { success: true, data: connections };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

// Export auth utilities for direct use
export { authInterceptor, authFetch } from './interceptors/authInterceptor';

// Default export
export default apiClient;
