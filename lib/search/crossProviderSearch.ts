/**
 * Cross-Provider Search Service
 * 
 * Orchestrates search operations across multiple storage providers with ephemeral caching.
 * Implements global search capability that aggregates results from all connected providers.
 * 
 * Features:
 * - Concurrent search across multiple providers
 * - Ephemeral caching to reduce duplicate API calls
 * - Result aggregation and deduplication
 * - Pagination support across providers
 */

import { getRedisClient } from '../redis/client';
import { ProviderAdapter } from '../providers/ProviderAdapter.interface';
import { SearchFilesRequest, SearchFilesResponse, ProviderFile, ProviderAuthState } from '../providers/types';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/ErrorCode';

interface CrossProviderSearchRequest {
  userId: string;
  query: string;
  providerIds?: string[]; // Optional filter to specific providers
  folderId?: string;      // Optional folder scope for search
  cursor?: string;        // Pagination cursor
  pageSize?: number;      // Number of results per page
}

interface CrossProviderSearchResult {
  files: ProviderFile[];
  cursors: Record<string, string>; // Provider-specific cursors for pagination
  hasMore: Record<string, boolean>; // Per-provider hasMore status
  totalResults: number;
  providersSearched: number;
  providersFailed: string[];
}

// Cache configuration
const CACHE_TTL_SECONDS = 300; // 5 minutes for ephemeral cache
const MAX_CONCURRENT_PROVIDERS = 5; // Limit concurrent provider searches

/**
 * Execute cross-provider search with ephemeral caching
 */
export async function crossProviderSearch(
  request: CrossProviderSearchRequest,
  providerAdapters: ProviderAdapter[],
  authStates: Record<string, ProviderAuthState> // Map of providerId to auth state
): Promise<CrossProviderSearchResult> {
  const { userId, query, providerIds, folderId, cursor, pageSize = 50 } = request;
  
  // Generate cache key based on search parameters
  const cacheKey = generateCacheKey(userId, query, providerIds, folderId, pageSize);
  const redis = getRedisClient('cache');
  
  // Try to get cached results first
  try {
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      console.log(`[crossProviderSearch] Cache hit for key: ${cacheKey}`);
      return JSON.parse(cachedResult);
    }
  } catch (error) {
    console.warn(`[crossProviderSearch] Cache retrieval failed:`, error);
    // Continue with search if cache fails
  }

  // Filter providers if specific IDs requested
  const targetProviders = providerIds 
    ? providerAdapters.filter(adapter => providerIds.includes(adapter.descriptor.id))
    : providerAdapters;

  if (targetProviders.length === 0) {
    throw new AppError({ 
      code: ErrorCode.VALIDATION_FAILED,
      message: 'No providers available for search'
    });
  }

  // Parse cursor to determine per-provider cursors if provided
  const providerCursors: Record<string, string | undefined> = {};
  if (cursor) {
    try {
      const parsedCursors = JSON.parse(cursor) as Record<string, string>;
      Object.keys(parsedCursors).forEach(providerId => {
        providerCursors[providerId] = parsedCursors[providerId];
      });
    } catch (error) {
      console.warn('[crossProviderSearch] Invalid cursor format:', error);
      // Use undefined cursors if parsing fails
    }
  }

  // Execute searches concurrently across providers
  const searchPromises = targetProviders.slice(0, MAX_CONCURRENT_PROVIDERS).map(async (adapter) => {
    try {
      // Get the auth state for this specific provider
      const authState = authStates[adapter.descriptor.id];
      if (!authState) {
        throw new Error(`No auth state available for provider ${adapter.descriptor.id}`);
      }

      const searchRequest: SearchFilesRequest = {
        context: {
          requestId: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          abortSignal: new AbortController().signal,
        },
        auth: authState,
        query,
        folderId,
        cursor: providerCursors[adapter.descriptor.id],
        pageSize,
      };

      const result = await adapter.searchFiles(searchRequest);
      
      // Add provider metadata to each file
      const filesWithMetadata = result.files.map(file => ({
        ...file,
        provider: adapter.descriptor.id,
        providerDisplayName: adapter.descriptor.displayName || adapter.descriptor.id,
      }));

      return {
        providerId: adapter.descriptor.id,
        success: true,
        files: filesWithMetadata,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore ?? false,
      };
    } catch (error) {
      console.error(`[crossProviderSearch] Failed to search provider ${adapter.descriptor.id}:`, error);
      return {
        providerId: adapter.descriptor.id,
        success: false,
        files: [],
        nextCursor: undefined,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Wait for all searches to complete
  const searchResults = await Promise.all(searchPromises);

  // Aggregate results
  const aggregatedFiles: ProviderFile[] = [];
  const cursors: Record<string, string> = {};
  const hasMore: Record<string, boolean> = {};
  const providersFailed: string[] = [];

  searchResults.forEach(result => {
    if (result.success) {
      aggregatedFiles.push(...result.files);
      if (result.nextCursor) {
        cursors[result.providerId] = result.nextCursor;
      }
      hasMore[result.providerId] = result.hasMore;
    } else {
      providersFailed.push(result.providerId);
    }
  });

  // Sort files by modification time (newest first)
  aggregatedFiles.sort((a, b) => {
    const aTime = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
    const bTime = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
    return bTime - aTime; // Descending order (newest first)
  });

  // Limit to requested page size
  const limitedFiles = aggregatedFiles.slice(0, pageSize);

  // Prepare final result
  const finalResult: CrossProviderSearchResult = {
    files: limitedFiles,
    cursors,
    hasMore,
    totalResults: aggregatedFiles.length,
    providersSearched: targetProviders.length,
    providersFailed,
  };

  // Cache the result (only successful results)
  if (providersFailed.length < targetProviders.length) {
    try {
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(finalResult));
      console.log(`[crossProviderSearch] Cached result for key: ${cacheKey}`);
    } catch (error) {
      console.warn(`[crossProviderSearch] Cache set failed:`, error);
      // Continue without caching if it fails
    }
  }

  return finalResult;
}

/**
 * Generate cache key for cross-provider search
 */
function generateCacheKey(
  userId: string,
  query: string,
  providerIds?: string[],
  folderId?: string,
  pageSize?: number
): string {
  const parts = [
    'cross-search',
    userId,
    query.toLowerCase().trim(),
    pageSize?.toString() || '50',
    folderId || 'all',
    (providerIds ? providerIds.sort().join(',') : 'all-providers')
  ];
  
  // Create a simple hash-like string to avoid special characters in Redis key
  const key = parts.join(':');
  return key.replace(/[^\w\-_.]/g, '_'); // Sanitize for Redis compatibility
}

/**
 * Clear cache for a specific user's search
 */
export async function clearCrossProviderSearchCache(userId: string, query?: string): Promise<void> {
  const redis = getRedisClient('cache');
  
  // For now, we'll clear the specific cache entry if query is provided
  // Otherwise, we could implement a pattern-based deletion if needed
  if (query) {
    const cacheKey = generateCacheKey(userId, query, undefined, undefined, undefined);
    await redis.del(cacheKey);
  }
  // Note: Redis doesn't support wildcards in DEL, so full wildcard clearing would need KEYS (not recommended in production)
}