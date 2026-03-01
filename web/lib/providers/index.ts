/**
 * Provider Registry
 * Central export point for all provider adapters
 */

import { ProviderId, ProviderConfig, PROVIDERS } from './types'
import { StorageProvider, providerRegistry } from './StorageProvider'

// Import all providers
import { GoogleDriveProvider } from './googleDrive'
import { OneDriveProvider } from './oneDrive'
import { DropboxProvider } from './dropbox'
import { BoxProvider } from './box'
import { WebDAVProvider } from './webdav'
import { VPSProvider } from './vps'
import { PCloudProvider } from './pcloud'
import { FilenProvider } from './filen'
import { YandexProvider } from './yandex'
import { LocalProvider } from './local'

// Register all providers
providerRegistry.register('google', () => new GoogleDriveProvider())
providerRegistry.register('onedrive', () => new OneDriveProvider())
providerRegistry.register('dropbox', () => new DropboxProvider())
providerRegistry.register('box', () => new BoxProvider())
providerRegistry.register('webdav', () => new WebDAVProvider())
providerRegistry.register('vps', () => new VPSProvider())
providerRegistry.register('pcloud', () => new PCloudProvider())
providerRegistry.register('filen', () => new FilenProvider())
providerRegistry.register('yandex', () => new YandexProvider())
providerRegistry.register('local', () => new LocalProvider())

export function getProvider(id: ProviderId): StorageProvider | undefined {
  return providerRegistry.get(id)
}

export function getProviderConfig(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id)
}

export function getAllProviderIds(): ProviderId[] {
  return providerRegistry.getAllIds()
}

export function isProviderImplemented(id: ProviderId): boolean {
  return providerRegistry.has(id)
}

export function getImplementedProviders(): ProviderConfig[] {
  return PROVIDERS.filter(p => providerRegistry.has(p.id))
}

export function getUnimplementedProviders(): ProviderConfig[] {
  return PROVIDERS.filter(p => !providerRegistry.has(p.id))
}

export * from './types'
export * from './StorageProvider'
