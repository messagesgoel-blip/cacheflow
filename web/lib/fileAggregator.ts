/**
 * File Aggregator
 * Merges files from multiple providers into a unified view
 */

import type { FileMetadata, ProviderId } from './providers/types'
export type { FileMetadata } from './providers/types'
import { getProvider } from './providers'

/**
 * Aggregated file item with duplicate detection
 */
export interface AggregatedFileItem extends FileMetadata {
  /** List of providers this file exists on */
  providers: ProviderId[]
  /** True if file exists on 2+ providers */
  isDuplicate: boolean
  /** Primary provider (first occurrence, typically most recently modified) */
  primaryProvider: ProviderId
}

/**
 * Result of aggregation including files and potential errors
 */
export interface AggregateResult {
  files: AggregatedFileItem[]
  errors: Array<{ providerId: ProviderId; error: string }>
}

/**
 * Options for aggregating files from multiple providers
 */
export interface AggregateOptions {
  /** Filter to specific providers (default: all provided) */
  providerFilter?: ProviderId[]
  /** Minimum age in ms to consider a file for duplicate detection */
  minAgeMs?: number
  /** Enable duplicate detection (default: true) */
  detectDuplicates?: boolean
}

/**
 * Aggregate files from multiple providers
 * @param providers - Array of provider instances to aggregate
 * @param folderId - Optional folder ID to list files from (root if not provided)
 * @param options - Aggregation options
 * @returns Object containing unified array of files and any errors encountered
 */
export async function aggregateFiles(
  providers: Array<{ providerId: ProviderId; listFiles: (options?: { folderId?: string }) => Promise<FileMetadata[]> }>,
  folderId?: string,
  options: AggregateOptions = {}
): Promise<AggregateResult> {
  const { providerFilter, minAgeMs = 0, detectDuplicates = true } = options

  // Filter providers if filter specified
  const providersToQuery = providerFilter
    ? providers.filter(p => providerFilter.includes(p.providerId))
    : providers

  if (providersToQuery.length === 0) {
    return { files: [], errors: [] }
  }

  // Fetch files from all providers in parallel, collecting both results and errors
  const fetchPromises = providersToQuery.map(async (provider) => {
    try {
      const files = await provider.listFiles({ folderId })
      return {
        files: files.map(file => ({
          ...file,
          providers: [provider.providerId] as ProviderId[],
          primaryProvider: provider.providerId,
        })),
        error: null as { providerId: ProviderId; error: string } | null
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`Failed to fetch files from provider ${provider.providerId}:`, error)
      return {
        files: [],
        error: { providerId: provider.providerId, error: errorMessage }
      }
    }
  })

  const results = await Promise.all(fetchPromises)
  const allFiles = results.flatMap(result => result.files)
  const errors = results.filter(result => result.error !== null).map(result => result.error!) as Array<{ providerId: ProviderId; error: string }>

  // Detect duplicates if enabled
  let aggregatedFiles: AggregatedFileItem[]
  if (detectDuplicates) {
    aggregatedFiles = detectDuplicateFiles(allFiles, minAgeMs)
  } else {
    aggregatedFiles = allFiles.map(file => ({
      ...file,
      isDuplicate: false,
    }))
  }

  // Sort by modified time (descending - most recent first)
  const sortedFiles = aggregatedFiles.sort((a, b) => {
    const timeA = new Date(a.modifiedTime).getTime()
    const timeB = new Date(b.modifiedTime).getTime()
    return timeB - timeA
  })

  return { files: sortedFiles, errors }
}

/**
 * Generate a normalized signature for duplicate detection
 * Creates a signature that works across providers with different path formats
 * Uses full filename (with extension) + size to prevent false positives between files with same name but different extensions
 */
function generateDuplicateSignature(file: FileMetadata): string {
  // Normalize the full filename (with extension) and convert to lowercase
  const fileName = file.name.toLowerCase()

  // Extract basename from path for providers that use ID-based paths
  // For example, Google Drive uses IDs in paths, but we can extract the name from the path structure
  const pathSegments = file.path.split(/[\/\\]/).filter(seg => seg.trim() !== '');
  const basename = pathSegments[pathSegments.length - 1]?.toLowerCase() || '';

  // Use the full filename (with extension) + size to avoid false positives
  // This approach works across providers with different path structures
  // Example: "report.pdf" and "report.txt" will have different signatures even if same size
  return `${fileName}|${file.size}`
}

/**
 * Detect duplicate files across providers
 * Groups files by normalized content signature (filename + size, path-independent) and marks duplicates
 */
function detectDuplicateFiles(
  files: Array<FileMetadata & { providers: ProviderId[]; primaryProvider: ProviderId }>,
  minAgeMs: number
): AggregatedFileItem[] {
  const now = Date.now()
  const fileMap = new Map<string, Array<FileMetadata & { providers: ProviderId[]; primaryProvider: ProviderId }>>()

  // Group files by normalized content signature
  for (const file of files) {
    // Create a signature based on normalized filename and size (path-independent)
    const signature = generateDuplicateSignature(file)

    const existing = fileMap.get(signature) || []
    existing.push(file)
    fileMap.set(signature, existing)
  }

  // Merge duplicates and mark them
  const result: AggregatedFileItem[] = []

  fileMap.forEach((group, signature) => {
    if (group.length === 1) {
      // Single occurrence - not a duplicate
      const file = group[0]
      result.push({
        ...file,
        providers: file.providers,
        primaryProvider: file.primaryProvider,
        isDuplicate: false,
      })
    } else {
      // Multiple occurrences - mark as duplicate
      // Merge provider lists, keeping the most recently modified as primary
      const sortedByModified = group.sort((a, b) => {
        const timeA = new Date(a.modifiedTime).getTime()
        const timeB = new Date(b.modifiedTime).getTime()
        return timeB - timeA
      })

      const allProviders = Array.from(new Set(group.flatMap(f => f.providers)))
      const primaryProvider = sortedByModified[0].primaryProvider
      const baseFile = sortedByModified[0]

      result.push({
        ...baseFile,
        providers: allProviders,
        primaryProvider,
        isDuplicate: allProviders.length >= 2,
      })
    }
  })

  return result
}

/**
 * Filter aggregated files by provider
 * @param files - Aggregated file list
 * @param providerId - Provider to filter by (undefined for all)
 * @returns Filtered file list
 */
export function filterByProvider(
  files: AggregatedFileItem[],
  providerId?: ProviderId
): AggregatedFileItem[] {
  if (!providerId) {
    return files
  }

  // Show files that exist on the selected provider
  return files.filter(file => file.providers.includes(providerId))
}

/**
 * Get duplicate files only
 * @param files - Aggregated file list
 * @returns Files that exist on multiple providers
 */
export function getDuplicatesOnly(files: AggregatedFileItem[]): AggregatedFileItem[] {
  return files.filter(file => file.isDuplicate)
}

/**
 * Get unique files only (not duplicated across providers)
 * @param files - Aggregated file list
 * @returns Files that exist on only one provider
 */
export function getUniqueOnly(files: AggregatedFileItem[]): AggregatedFileItem[] {
  return files.filter(file => !file.isDuplicate)
}

/**
 * Get provider distribution stats
 * @param files - Aggregated file list
 * @returns Count of files per provider
 */
export function getProviderDistribution(
  files: AggregatedFileItem[]
): Record<ProviderId, number> {
  const distribution: Record<ProviderId, number> = {} as Record<ProviderId, number>

  for (const file of files) {
    for (const provider of file.providers) {
      distribution[provider] = (distribution[provider] || 0) + 1
    }
  }

  return distribution
}

/**
 * Compute a unique key for a file (for deduplication in UI lists)
 */
export function getFileKey(file: AggregatedFileItem): string {
  return `${file.primaryProvider}:${file.path}/${file.name}`
}

