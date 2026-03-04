/**
 * CacheFlow API Client
 *
 * Centralized HTTP client with:
 * - Auth interceptor for automatic token refresh
 * - Per-provider rate-limit queue (back-pressure + 429 back-off)
 * - Request/response logging (dev mode)
 * - Error normalization
 * - Type-safe API methods
 *
 * Gate: AUTH-1, AUTH-4, TRANSFER-1
 * Task: 1.1@AUTH-1, 3.15@TRANSFER-1
 */

import { authInterceptor, authFetch } from './interceptors/authInterceptor';
import {
  getRateLimitQueue,
  parseRetryAfterMs,
  type RateLimitedCallResult,
} from './providers/rateLimitQueue';
import type { ProviderId } from './providers/types';

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
  accountName: string;
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
    const response = await authFetch('/api/connections');
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  },

  /**
   * Proxy a request to a remote provider API
   */
  async proxyRequest(remoteId: string, method: string, url: string, headers?: Record<string, string>, body?: any): Promise<ApiResponse<any>> {
    try {
      const proxyData = {
        method,
        url,
        headers,
        body,
      };

      const response = await authInterceptor(`${API_BASES.remotes}/${remoteId}/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyData),
      });

      if (!response.ok) {
        // Check if response contains requiresReauth flag
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Proxy request failed',
      };
    }
  },

  /**
   * Proxy a provider API request through the per-provider rate-limit queue.
   *
   * On HTTP 429 the queue is paused for the duration specified by the
   * provider's `Retry-After` header (or 60 s if absent), and the error is
   * surfaced to the caller as `success: false` with `rateLimited: true`.
   */
  async proxyRequestRateLimited(
    providerId: ProviderId,
    remoteId: string,
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: unknown,
  ): Promise<ApiResponse<unknown> & { rateLimited?: boolean; waitMs?: number }> {
    const queue = getRateLimitQueue();

    let callResult: RateLimitedCallResult<Response>;
    try {
      callResult = await queue.enqueue(providerId, () =>
        authInterceptor(`${API_BASES.remotes}/${remoteId}/proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, url, headers, body }),
        }),
      );
    } catch (queueError) {
      return {
        success: false,
        error: queueError instanceof Error ? queueError.message : 'Queue timeout',
        rateLimited: true,
      };
    }

    const { data: response, waitMs } = callResult;

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers) ?? 60_000;
      queue.applyRateLimitBackoff(providerId, retryAfterMs);
      return {
        success: false,
        error: `Rate limited by provider "${providerId}" — retry after ${retryAfterMs} ms`,
        rateLimited: true,
        waitMs,
      };
    }

    if (!response.ok) {
      let errorData: { error?: string };
      try {
        errorData = await response.json() as { error?: string };
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      return {
        success: false,
        error: errorData.error ?? `HTTP ${response.status}: ${response.statusText}`,
        waitMs,
      };
    }

    const data = await response.json();
    return { success: true, data, waitMs };
  },
};

// Export auth utilities for direct use
export { authInterceptor, authFetch } from './interceptors/authInterceptor';

export { getRateLimitQueue, parseRetryAfterMs } from './providers/rateLimitQueue';
export type { ProviderQueueConfig, RateLimitedCallResult } from './providers/rateLimitQueue';

// Default export
export default apiClient;
