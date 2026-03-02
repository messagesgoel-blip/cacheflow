/**
 * Auth Interceptor for CacheFlow
 * 
 * Handles:
 * - 401 detection and automatic token refresh
 * - Singleton refresh promise (prevents concurrent refresh race conditions)
 * - Retry logic for failed requests after token refresh
 * 
 * Gate: AUTH-1, AUTH-4
 * Task: 1.1@AUTH-1
 */

let refreshPromise: Promise<string> | null = null;

/**
 * Singleton token refresh - ensures only one refresh happens at a time
 * even if multiple 401s occur concurrently
 */
async function refreshAuthToken(): Promise<string> {
  // If refresh is already in progress, return that promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include HttpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const data = await response.json();
      return data.accessToken;
    } finally {
      // Clear the refresh promise so future 401s can trigger new refresh
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Auth interceptor - wraps fetch calls with automatic token refresh on 401
 * 
 * Usage:
 * ```ts
 * const response = await authInterceptor.fetch('/api/remotes/uuid/files', {
 *   method: 'GET',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 */
export async function authInterceptor(
  url: string,
  options: RequestInit = {},
  maxRetries = 1
): Promise<Response> {
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
      });

      // Not a 401 - return as-is
      if (response.status !== 401) {
        return response;
      }

      // 401 detected - attempt token refresh
      retryCount++;
      
      if (retryCount > maxRetries) {
        // Max retries exceeded - redirect to login or throw
        window.location.href = '/login?reason=session_expired';
        throw new Error('Session expired - redirecting to login');
      }

      // Refresh the token
      await refreshAuthToken();

      // Retry the original request with updated credentials
      // Note: cookies are automatically included via credentials: 'include'
      continue;
    } catch (error) {
      // Network error or other failure
      if (retryCount >= maxRetries) {
        throw error;
      }
      retryCount++;
    }
  }

  throw new Error('Auth interceptor failed after retries');
}

/**
 * Create a fetch wrapper with auth interception pre-configured
 */
export function createAuthFetch(defaultOptions: RequestInit = {}) {
  return function authFetch(url: string, options: RequestInit = {}) {
    return authInterceptor(url, {
      ...defaultOptions,
      ...options,
      credentials: options.credentials || defaultOptions.credentials || 'include',
    });
  };
}

// Export singleton auth fetch instance
export const authFetch = createAuthFetch();
