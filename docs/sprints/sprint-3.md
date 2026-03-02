# Sprint 3 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 3.1 | Persistent Transfer Manager Tray — always visible when active | /components/transfers/TransferTray.tsx, /components/transfers/TransferItem.tsx, /context/TransferContext.tsx | ◆ ClaudeCode | TRANSFER-1 |
| 3.10 | BullMQ background job queue for async transfers | /lib/queue/transferQueue.ts, /lib/queue/workers/transferWorker.ts | ◈ OpenCode | SSE-1, TRANSFER-1 |
| 3.11 | Conflict resolution modal — shared component used everywhere | /components/transfers/ConflictResolutionModal.tsx | ◆ ClaudeCode | TRANSFER-1 |
| 3.12 | Zero-disk verification test + tab-close survival test ⚠️ Human verify | /e2e/tests/zeroDiskTransfer.spec.ts | ◉ Gemini | ZERODISK-1 |
| 3.13 | Storage pooling dashboard — promote aggregate to hero position | /app/dashboard/page.tsx, /components/dashboard/StorageHero.tsx, /components/dashboard/ProviderCapacityBar.tsx | ◆ ClaudeCode | SCHED-1 |
| 3.14 | Provider health indicators — green means it actually works | /lib/providers/healthCheck.ts, /app/api/connections/health/route.ts | ◈ OpenCode | SYNC-1 |
| 3.15 | Rate limit handling layer — per-provider request queue | /lib/providers/rateLimitQueue.ts, /lib/apiClient.ts | ◈ OpenCode | TRANSFER-1 |
| 3.16 | Dashboard + health E2E tests | /e2e/tests/storageDashboard.spec.ts | ◉ Gemini | SYNC-1 |
| 3.2 | Server-Sent Events (SSE) for real-time transfer progress | /app/api/transfers/[id]/progress/route.ts, /lib/transfers/progressEmitter.ts | ◈ OpenCode | SSE-1 |
| 3.3 | Every file operation produces tray entry + toast | /lib/transfers/transferRegistry.ts, /app/api/remotes/[uuid]/**/route.ts | ◈ OpenCode | TRANSFER-1 |
| 3.4 | Tray E2E — entry survives navigation, retry works on failure | /e2e/tests/transferTray.spec.ts | ◉ Gemini | TRANSFER-1 |
| 3.5 | Chunked upload: files >50MB use provider resumable upload APIs | /lib/providers/googleDrive/chunkedUpload.ts, /lib/providers/onedrive/chunkedUpload.ts, /lib/providers/dropbox/chunkedUpload.ts | ◈ OpenCode | TRANSFER-1 |
| 3.6 | Auto-resume: resume interrupted upload from last successful chunk | /app/api/transfers/[id]/chunks/route.ts, /lib/transfers/chunkStateManager.ts | ◈ OpenCode | TRANSFER-1 |
| 3.7 | Tray: chunk-level progress for large files | /components/transfers/TransferItem.tsx | ◆ ClaudeCode | TRANSFER-1 |
| 3.8 | Auto-resume E2E test — network drop mid-transfer ⚠️ Human verify | /e2e/tests/chunkedResume.spec.ts | ◉ Gemini | TRANSFER-1 |
| 3.9 | Server streams source → CacheFlow → target without disk write | /lib/transfers/streamTransfer.ts | ◈ OpenCode | ZERODISK-1 |
