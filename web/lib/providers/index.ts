/**
 * Provider Registry
 * Central export point for all provider adapters
 */

import { ProviderId, ProviderConfig, PROVIDERS } from './types'
import { StorageProvider, providerRegistry } from './StorageProvider'

// Import all providers
import { GoogleDriveProvider } from './googleDrive'
import { OneDriveProvider } from './oneDrive'
import { WebDAVProvider } from './webdav'

// Register providers
providerRegistry.register('google', () => new GoogleDriveProvider())
providerRegistry.register('onedrive', () => new OneDriveProvider())
providerRegistry.register('webdav', () => new WebDAVProvider())

// TODO: Register remaining providers when implemented
// providerRegistry.register('onedrive', () => new OneDriveProvider())
// providerRegistry.register('dropbox', () => new DropboxProvider())
// providerRegistry.register('box', () => new BoxProvider())
// providerRegistry.register('pcloud', () => new PCloudProvider())
// providerRegistry.register('filen', () => new FilenProvider())
// providerRegistry.register('yandex', () => new YandexProvider())

/**
 * Get a provider instance by ID
 */
export function getProvider(id: ProviderId): StorageProvider | undefined {
  return providerRegistry.get(id)
}

/**
 * Get provider configuration
 */
export function getProviderConfig(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id)
}

/**
 * Get all available provider IDs
 */
export function getAllProviderIds(): ProviderId[] {
  return providerRegistry.getAllIds()
}

/**
 * Check if a provider is implemented
 */
export function isProviderImplemented(id: ProviderId): boolean {
  return providerRegistry.has(id)
}

/**
 * Get list of implemented providers
 */
export function getImplementedProviders(): ProviderConfig[] {
  return PROVIDERS.filter(p => providerRegistry.has(p.id))
}

/**
 * Get list of unimplemented providers
 */
export function getUnimplementedProviders(): ProviderConfig[] {
  return PROVIDERS.filter(p => !providerRegistry.has(p.id))
}

// Re-export types
export * from './types'
export * from './StorageProvider'
