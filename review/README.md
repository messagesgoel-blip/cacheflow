# CacheFlow Code Review Package

This folder contains the source code for external review.

## What's Included

### Components (`review/components/`)
- **DrivePanel.tsx** - Cloud storage sidebar showing connected providers
- **FileBrowser.tsx** - File browser with cloud provider support
- **ProviderHub.tsx** - Provider management UI
- **RemotesPanel.tsx** - OAuth connection handlers
- **SettingsPanel.tsx** - User settings with connected accounts
- **UnifiedFileBrowser.tsx** - Unified file browser for all cloud providers
- **UploadModal.tsx** - File upload with cloud provider selection

### Provider System (`review/providers/`)
- **types.ts** - TypeScript interfaces and provider configurations
- **StorageProvider.ts** - Abstract base class for all providers
- **googleDrive.ts** - Google Drive adapter
- **oneDrive.ts** - OneDrive adapter
- **dropbox.ts** - Dropbox adapter
- **box.ts** - Box adapter
- **webdav.ts** - WebDAV adapter
- **vps.ts** - VPS/SFTP adapter
- **pcloud.ts** - pCloud adapter (NEW)
- **filen.ts** - Filen adapter (NEW)
- **yandex.ts** - Yandex adapter (NEW)

### Core (`review/`)
- **tokenManager.ts** - Browser-based token storage with localStorage
- **api.ts** - API client for backend communication

### Documentation
- **CACHEFLOW_ROADMAP.md** - Full project roadmap

## Architecture Highlights

1. **Browser-based OAuth** - All cloud providers use client-side OAuth flows
2. **Token Storage** - Tokens stored in browser localStorage (with SSR guards)
3. **No rclone** - Direct API calls to cloud providers from browser
4. **Provider Adapters** - Each cloud storage has its own adapter following StorageProvider interface

## Key Technologies
- React/Next.js frontend
- TypeScript
- OAuth 2.0 / PKCE for authentication
- IndexedDB for metadata caching (planned)
